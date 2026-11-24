"use client";
import { authorizeCancellation } from "@/lib/cancel-authorization";
import { assignTicket, getTickets, listSupportAgents, respondToTicket, updateTicketStatus } from "@/lib/admin-store";
import { pullTickets } from "@/lib/ticket-sync";
import type { SupportTicket } from "@/types";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, TextInput } from "@/components/admin/AdminUI";
import { useAuth } from "@/components/auth/AuthContext";
import { getOrdersForAccount, initiateReturn } from "@/lib/store";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { refundThroughGateway } from "@/lib/payments-client";
import { cancelOrder, getOrder as getOrderById, getShipments, maxRefundable } from "@/lib/admin-store";
import { dropOrderShipments } from "@/lib/shipping-client";
import { canCustomerCancel, getOrderSettings } from "@/lib/integrations";
import { formatDateTime } from "@/lib/utils";
import type { Order } from "@/types";

function deliveredOn(order: Order) {
  return order.history?.slice().reverse().find((entry) => entry.status === "Delivered")?.at ?? "";
}

/** Return window from Order settings (or the product's own days), counted from delivery. */
function returnWindowOpen(order: Order) {
  if (order.status !== "Delivered" || order.returnRequest) return false;
  const at = Date.parse(deliveredOn(order));
  if (!Number.isFinite(at)) return false;
  const days = order.returnableDays || getOrderSettings().returns.windowDays;
  return Date.now() - at <= days * 24 * 3600 * 1000;
}

type Approval = { id: string; kind: "refund" | "cancel" | "return"; orderId: string; amount?: number; reason: string; requestedBy: string; requestedAt: string; status: "pending" | "approved" | "rejected"; decidedBy?: string; decidedAt?: string };

function useApprovals() {
  const [rows, setRows] = useState<Approval[]>([]);
  const load = useCallback(async () => {
    const response = await fetch("/api/desk/approvals", { credentials: "same-origin", cache: "no-store" }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { approvals?: Approval[] } | null;
    setRows(data?.approvals ?? []);
  }, []);
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);
  return { rows, load };
}

async function postApproval(body: Record<string, unknown>) {
  const response = await fetch("/api/desk/approvals", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !data?.ok) throw new Error(data?.error || "The request could not be saved.");
}

/** Runs an approved action in the Admin's session (same calls as the order screen). */
async function runAction(order: Order, kind: Approval["kind"], reason: string, amount: number | undefined, by: string) {
  if (kind === "cancel") {
    if (!(await authorizeCancellation([order.id]))) throw new Error("Cancellation stopped: the OTP was not entered.");
    await dropOrderShipments(order.id);
    cancelOrder(order.id, reason || `Cancelled by ${by}`);
    return `Order ${order.id} cancelled.`;
  }
  if (kind === "return") {
    initiateReturn(order, { kind: "return", reason: reason || "Requested over chat", source: "admin" });
    return `Return opened on ${order.id}. Book the return pickup from the order screen.`;
  }
  const value = amount && amount > 0 ? amount : maxRefundable(order);
  await refundThroughGateway(order.id, value);
  return `Refund of ₹${value} started on ${order.id}.`;
}

/** Admin queue of refund / cancel / return requests from care and staff. */
export function DeskApprovals() {
  useCommerceMirror();
  const { user } = useAuth();
  const admin = user?.role === "admin" || user?.role === "coadmin";
  const { rows, load } = useApprovals();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const pending = rows.filter((row) => row.status === "pending");
  const decide = async (row: Approval, decision: "approved" | "rejected") => {
    setBusy(row.id);
    setNote("");
    try {
      let done = "Rejected.";
      if (decision === "approved") {
        const order = getOrderById(row.orderId);
        if (!order) throw new Error(`Order ${row.orderId} is not loaded on this device yet. Open Orders once, then try again.`);
        done = await runAction(order, row.kind, row.reason, row.amount, user?.email || "Admin");
      }
      await postApproval({ action: "decide", id: row.id, decision });
      setNote(done);
      await load();
    } catch (problem) {
      setNote(problem instanceof Error ? problem.message : "That didn't work.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="rounded-xl border border-border bg-white p-4 text-sm">
      <p className="font-semibold text-text-primary">Approvals ({pending.length} waiting)</p>
      <p className="mt-1 text-xs text-text-muted">Refund, cancel and return requests from care and staff. {admin ? "Approve runs the action at once." : "Only Admin can approve."}</p>
      <ul className="mt-3 space-y-2">
        {rows.slice(0, 50).map((row) => (
          <li key={row.id} className="rounded-lg border border-border p-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-text-primary">
                {row.kind === "refund" ? `Refund${row.amount ? ` ₹${row.amount}` : " (full refundable)"}` : row.kind === "cancel" ? "Cancel order" : "Start return"} ·{" "}
                <Link href={`/admin/commerce/orders?order=${encodeURIComponent(row.orderId)}`} className="font-mono text-burgundy underline">{row.orderId}</Link>
              </span>
              <span className={row.status === "pending" ? "font-semibold text-amber-700" : row.status === "approved" ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{row.status}</span>
            </div>
            <p className="mt-1 text-text-muted">
              {row.reason || "No reason given"} · by {row.requestedBy} · {formatDateTime(row.requestedAt)}
              {row.decidedBy ? ` · ${row.status} by ${row.decidedBy} ${formatDateTime(row.decidedAt || "")}` : ""}
            </p>
            {admin && row.status === "pending" ? (
              <div className="mt-2 flex gap-2">
                <Button variant="outline" disabled={busy === row.id} onClick={() => void decide(row, "approved")}>{busy === row.id ? "Working…" : "Approve"}</Button>
                <Button variant="outline" disabled={busy === row.id} onClick={() => void decide(row, "rejected")}>Reject</Button>
              </div>
            ) : null}
          </li>
        ))}
        {!rows.length ? <li className="text-xs text-text-muted">No requests yet.</li> : null}
      </ul>
      {note ? <p className="mt-2 text-xs font-semibold text-burgundy">{note}</p> : null}
    </div>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const shipment = getShipments().find((row) => row.orderId === order.id && row.note !== "Cancelled");
  const scan = shipment?.tracking?.[shipment.tracking.length - 1];
  const history = [...(order.history ?? [])].reverse().slice(0, 8);
  const address = order.deliveryAddress;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer font-semibold text-burgundy">Detailed status</summary>
      <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <div><dt className="inline text-text-muted">Payment: </dt><dd className="inline">{order.paymentStatus}{order.paymentMethod ? ` · ${order.paymentMethod}` : ""}{order.paidAt ? ` · ${formatDateTime(order.paidAt)}` : ""}{order.paymentRef ? ` · ${order.paymentRef}` : ""}</dd></div>
        <div><dt className="inline text-text-muted">Total: </dt><dd className="inline">₹{order.total}{order.refundAmount ? ` · refunded ₹${order.refundAmount}` : ""}{order.preorderPayment ? ` · advance ₹${order.preorderPayment.advance}, balance ₹${order.preorderPayment.balance}${order.preorderPayment.balancePaidAt ? " (paid)" : ""}` : ""}</dd></div>
        <div><dt className="inline text-text-muted">Delivery: </dt><dd className="inline">{order.deliveryMode === "store_pickup" ? "Store pickup" : [address?.city, address?.state, address?.pincode].filter(Boolean).join(", ")}</dd></div>
        <div><dt className="inline text-text-muted">Courier: </dt><dd className="inline">{shipment ? `${shipment.courier} · AWB ${shipment.awb} · ${shipment.status}` : order.trackingId ? `${order.courierName ?? ""} ${order.trackingId}` : "Not booked yet"}</dd></div>
        {shipment?.pickupScheduledFor ? <div><dt className="inline text-text-muted">Pickup: </dt><dd className="inline">{formatDateTime(shipment.pickupScheduledFor)}{shipment.pickupSlot ? ` · ${shipment.pickupSlot}` : ""}</dd></div> : null}
        {shipment?.expectedBy || order.eta ? <div><dt className="inline text-text-muted">Expected delivery: </dt><dd className="inline">{shipment?.expectedBy || order.eta}</dd></div> : null}
        {scan ? <div className="sm:col-span-2"><dt className="inline text-text-muted">Latest scan: </dt><dd className="inline">{scan.status}{scan.location ? ` · ${scan.location}` : ""} · {formatDateTime(scan.at)}</dd></div> : null}
        {order.returnRequest ? <div className="sm:col-span-2"><dt className="inline text-text-muted">Return/replacement: </dt><dd className="inline">{order.returnRequest.kind} · {order.returnRequest.status} · {order.returnRequest.reason}</dd></div> : null}
      </dl>
      {history.length ? (
        <ol className="mt-2 space-y-0.5 border-l border-border pl-3">
          {history.map((entry, index) => (
            <li key={`${entry.at}-${index}`}><span className="font-semibold">{entry.status}</span> · {formatDateTime(entry.at)}{entry.note ? ` · ${entry.note}` : ""}</li>
          ))}
        </ol>
      ) : null}
    </details>
  );
}

/**
 * A customer's orders beside a chat or ticket, with full status. Admin's cancel, return and refund run at once (also
 * after the deadlines); care and staff send them to Admin for approval, within the deadlines.
 */
export function CustomerOrders({ email, phone }: { email?: string; phone?: string }) {
  useCommerceMirror();
  const { user } = useAuth();
  const admin = user?.role === "admin" || user?.role === "coadmin";
  const { rows: approvals, load: reloadApprovals } = useApprovals();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const orders = email || phone ? getOrdersForAccount({ email, phone }) : [];
  if (!orders.length) return <p className="mt-3 rounded-lg bg-warm-cream p-2.5 text-xs text-text-muted">No orders found for this customer.</p>;
  const act = async (key: string, work: () => Promise<string> | string) => {
    setBusy(key);
    setNote("");
    try {
      setNote(await work());
    } catch (problem) {
      setNote(problem instanceof Error ? problem.message : "That didn't work.");
    } finally {
      setBusy("");
    }
  };
  const go = (order: Order, kind: Approval["kind"], amount?: number) => {
    const key = `${kind}${order.id}`;
    const reason = reasons[order.id] || "";
    if (admin) {
      const label = kind === "refund" ? `Refund ₹${amount ?? maxRefundable(order)} on ${order.id}?` : kind === "cancel" ? `Cancel order ${order.id}? The customer is notified.` : `Start a return on ${order.id}?`;
      if (!window.confirm(label)) return;
      void act(key, () => runAction(order, kind, reason, amount, user?.email || "Admin"));
      return;
    }
    void act(key, async () => {
      await postApproval({ action: "request", kind, orderId: order.id, amount, reason });
      await reloadApprovals();
      return "Sent to Admin for approval.";
    });
  };
  return (
    <div className="mt-3 rounded-xl border border-border bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Customer orders ({orders.length})</p>
      <ul className="mt-2 space-y-2">
        {orders.slice(0, 10).map((order) => {
          const cap = maxRefundable(order);
          const cancelInTime = canCustomerCancel(order);
          const cancellable = order.status !== "Cancelled" && order.status !== "Delivered" && !order.returnRequest;
          const returnInTime = returnWindowOpen(order);
          const returnable = order.status === "Delivered" && !order.returnRequest;
          const refundInTime = cancelInTime || returnInTime || order.status === "Cancelled" || Boolean(order.returnRequest);
          const waiting = (kind: Approval["kind"]) => approvals.find((row) => row.orderId === order.id && row.kind === kind && row.status === "pending");
          const label = (base: string, inTime: boolean) => (admin ? `${base}${inTime ? "" : " (after deadline)"}` : `Request ${base.toLowerCase()} · Admin approves`);
          const showCancel = cancellable && (cancelInTime || admin);
          const showReturn = returnable && (returnInTime || admin);
          const showRefund = cap > 0 && (refundInTime || admin);
          return (
            <li key={order.id} className="rounded-lg border border-border p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/commerce/orders?order=${encodeURIComponent(order.id)}`} className="font-mono font-semibold text-burgundy underline">{order.id}</Link>
                <span className="font-semibold text-text-primary">{order.status} · {order.paymentStatus} · ₹{order.total}</span>
              </div>
              <p className="mt-1 text-text-muted">
                {formatDateTime(order.date)} · {order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}
              </p>
              <OrderDetail order={order} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {showCancel || showReturn || showRefund ? (
                  <TextInput className="w-44" placeholder="Reason" value={reasons[order.id] ?? ""} onChange={(event) => setReasons({ ...reasons, [order.id]: event.target.value })} />
                ) : null}
                {showCancel ? (
                  waiting("cancel") ? <span className="font-semibold text-amber-700">Cancel waiting for Admin</span> : (
                    <Button variant="outline" disabled={busy === `cancel${order.id}`} onClick={() => go(order, "cancel")}>{busy === `cancel${order.id}` ? "Working…" : label("Cancel order", cancelInTime)}</Button>
                  )
                ) : null}
                {showReturn ? (
                  waiting("return") ? <span className="font-semibold text-amber-700">Return waiting for Admin</span> : (
                    <Button variant="outline" disabled={busy === `return${order.id}`} onClick={() => go(order, "return")}>{busy === `return${order.id}` ? "Working…" : label("Start return", returnInTime)}</Button>
                  )
                ) : null}
                {!admin && (cancellable || returnable) && !showCancel && !showReturn ? <span className="text-text-muted">Past the deadline · only Admin can act</span> : null}
              </div>
              {showRefund ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TextInput type="number" min={0} className="w-28" placeholder={`Up to ₹${cap}`} value={amounts[order.id] ?? ""} onChange={(event) => setAmounts({ ...amounts, [order.id]: event.target.value })} />
                  {waiting("refund") ? <span className="font-semibold text-amber-700">Refund waiting for Admin</span> : (
                    <Button variant="outline" disabled={busy === `refund${order.id}`} onClick={() => go(order, "refund", Math.min(cap, Number(amounts[order.id]) || cap))}>
                      {busy === `refund${order.id}` ? "Working…" : label("Refund", refundInTime)}
                    </Button>
                  )}
                </div>
              ) : cap > 0 ? (
                <p className="mt-2 text-text-muted">Refund window closed · only Admin can refund</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {note ? <p className="mt-2 text-xs font-semibold text-burgundy">{note}</p> : null}
    </div>
  );
}


const TICKET_STATUSES: SupportTicket["status"][] = ["Open", "In Progress", "Resolved", "Closed"];

export function CustomerTickets({ email, phone, ticketId }: { email?: string; phone?: string; ticketId?: string }) {
  const [tickets, setTickets] = useState<SupportTicket[]>(() => getTickets());
  const [showAllOpen, setShowAllOpen] = useState(false);
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const agents = listSupportAgents();

  const syncNow = () => {
    void pullTickets().then(() => setTickets(getTickets()));
    setTickets(getTickets());
  };

  useEffect(() => {
    syncNow();
    const timer = window.setInterval(syncNow, 8000);
    return () => window.clearInterval(timer);
  }, [email, phone, ticketId]);

  const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
  const cleanEmail = (email || "").trim().toLowerCase();

  const matching = tickets.filter((t) => {
    if (ticketId && t.id === ticketId) return true;
    const tEmail = (t.email || "").trim().toLowerCase();
    const tPhone = (t.phone || "").replace(/\D/g, "").slice(-10);
    if (cleanEmail && tEmail === cleanEmail) return true;
    if (cleanPhone.length === 10 && tPhone === cleanPhone) return true;
    return false;
  });

  const shown = showAllOpen
    ? tickets.slice(0, 25)
    : matching;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">
          🎫 Support Tickets ({matching.length} for this customer · {tickets.filter((t) => t.status === "Open" || t.status === "In Progress").length} open total)
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAllOpen((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            {showAllOpen ? `Show Customer Tickets (${matching.length})` : `View All Desk Tickets (${tickets.length})`}
          </button>
          <button
            type="button"
            onClick={syncNow}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {toast ? <p className="mt-1.5 font-semibold text-emerald-700">{toast}</p> : null}

      {shown.length === 0 ? (
        <p className="mt-2 text-slate-500">No support tickets linked to this customer yet. Click &quot;View All Desk Tickets&quot; to see all tickets or use &quot;Create ticket&quot; above.</p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {shown.map((t) => (
            <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-slate-900">#{t.id}</span>{" "}
                  <span className="font-semibold text-slate-900">{t.subject}</span>
                  <span className="ml-2 text-slate-500">({t.name} · {t.email}{t.phone ? ` · ${t.phone}` : ""})</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label="Ticket status"
                    value={t.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as SupportTicket["status"];
                      updateTicketStatus(t.id, nextStatus);
                      setTickets(getTickets());
                      setToast(`Ticket #${t.id} status updated to ${nextStatus}.`);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900"
                  >
                    {TICKET_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Assign ticket"
                    value={t.assignedTo ?? ""}
                    onChange={(e) => {
                      assignTicket(t.id, e.target.value);
                      setTickets(getTickets());
                      setToast(`Ticket #${t.id} assigned.`);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.email} value={a.email}>{a.firstName} {a.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-slate-700">{t.body}</p>
              {t.responses?.length ? (
                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {t.responses.slice(-3).map((r, idx) => (
                    <p key={idx} className="rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                      <b className="text-slate-900">{r.from}:</b> {r.text}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={replyMap[t.id] ?? ""}
                  onChange={(e) => setReplyMap({ ...replyMap, [t.id]: e.target.value })}
                  placeholder="Write a ticket reply (emailed & synced)…"
                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const txt = (replyMap[t.id] ?? "").trim();
                    if (!txt) return;
                    respondToTicket(t.id, "Customer Care", txt);
                    setReplyMap({ ...replyMap, [t.id]: "" });
                    setTickets(getTickets());
                    setToast(`Reply sent on Ticket #${t.id}.`);
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                >
                  Reply
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
