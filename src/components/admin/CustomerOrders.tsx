"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, TextInput } from "@/components/admin/AdminUI";
import { useAuth } from "@/components/auth/AuthContext";
import { getOrdersForAccount, initiateReturn } from "@/lib/store";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { refundThroughGateway } from "@/lib/payments-client";
import { cancelOrder, maxRefundable } from "@/lib/admin-store";
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

/**
 * A customer's orders beside a chat or ticket, with cancel, return and refund.
 * Staff act only inside the policy deadlines; Admin and co-admin may act after them too.
 */
export function CustomerOrders({ email, phone }: { email?: string; phone?: string }) {
  useCommerceMirror();
  const { user } = useAuth();
  const admin = user?.role === "admin" || user?.role === "coadmin";
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
          const late = (inTime: boolean) => (!inTime && admin ? " (after deadline · Admin)" : "");
          return (
            <li key={order.id} className="rounded-lg border border-border p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/commerce/orders?order=${encodeURIComponent(order.id)}`} className="font-mono font-semibold text-burgundy underline">{order.id}</Link>
                <span className="font-semibold text-text-primary">{order.status} · {order.paymentStatus} · ₹{order.total}</span>
              </div>
              <p className="mt-1 text-text-muted">
                {formatDateTime(order.date)} · {order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}
                {order.trackingId ? ` · AWB ${order.trackingId}${order.courierName ? ` (${order.courierName})` : ""}` : ""}
                {order.returnRequest ? ` · ${order.returnRequest.kind} ${order.returnRequest.status}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(cancellable && (cancelInTime || admin)) || (returnable && (returnInTime || admin)) ? (
                  <TextInput className="w-44" placeholder="Reason" value={reasons[order.id] ?? ""} onChange={(event) => setReasons({ ...reasons, [order.id]: event.target.value })} />
                ) : null}
                {cancellable && (cancelInTime || admin) ? (
                  <Button
                    variant="outline"
                    disabled={busy === `c${order.id}`}
                    onClick={() => {
                      if (!window.confirm(`Cancel order ${order.id}? The customer is notified.`)) return;
                      void act(`c${order.id}`, async () => {
                        await dropOrderShipments(order.id);
                        cancelOrder(order.id, reasons[order.id] || `Cancelled from chat by ${user?.email || "desk"}`);
                        return `Order ${order.id} cancelled. Refund it below if paid.`;
                      });
                    }}
                  >
                    {busy === `c${order.id}` ? "Cancelling…" : `Cancel order${late(cancelInTime)}`}
                  </Button>
                ) : null}
                {returnable && (returnInTime || admin) ? (
                  <Button
                    variant="outline"
                    disabled={busy === `r${order.id}`}
                    onClick={() =>
                      void act(`r${order.id}`, () => {
                        initiateReturn(order, { kind: "return", reason: reasons[order.id] || "Requested over chat", source: "admin" });
                        return `Return opened on ${order.id}. Book the return pickup from the order screen.`;
                      })
                    }
                  >
                    {`Start return${late(returnInTime)}`}
                  </Button>
                ) : null}
                {!cancellable && !returnable && !admin ? null : !cancelInTime && !returnInTime && !admin && (cancellable || returnable) ? (
                  <span className="text-text-muted">Past the deadline · Admin can still act</span>
                ) : null}
              </div>
              {cap > 0 && (refundInTime || admin) ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TextInput type="number" min={0} className="w-28" placeholder={`Up to ₹${cap}`} value={amounts[order.id] ?? ""} onChange={(event) => setAmounts({ ...amounts, [order.id]: event.target.value })} />
                  <Button
                    variant="outline"
                    disabled={busy === order.id}
                    onClick={() => {
                      const value = Number(amounts[order.id] || cap);
                      if (!window.confirm(`Refund ₹${value} on order ${order.id}?`)) return;
                      void act(order.id, async () => {
                        await refundThroughGateway(order.id, value);
                        return `Refund of ₹${value} started on ${order.id}.`;
                      });
                    }}
                  >
                    {busy === order.id ? "Refunding…" : `Initiate refund${late(refundInTime)}`}
                  </Button>
                </div>
              ) : cap > 0 ? (
                <p className="mt-2 text-text-muted">Refund window closed · Admin can still refund</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {note ? <p className="mt-2 text-xs font-semibold text-burgundy">{note}</p> : null}
    </div>
  );
}
