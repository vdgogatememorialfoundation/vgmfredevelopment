"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, EmptyState, Panel, TextInput } from "@/components/admin/AdminUI";
import { cancelOrder, maxRefundable, refundToStoreCredit } from "@/lib/admin-store";
import { APPROVAL_LABELS, decideApproval } from "@/lib/approvals";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { refundThroughGateway } from "@/lib/payments-client";
import { getOrders, getReturnRequest, reviewReplacementRequest, updateReturnRequest } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";
import type { Order } from "@/types";

const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** Carries out what the desk asked for once a senior reviewer approves it. */
async function carryOut(order: Order): Promise<string> {
  const approval = order.approval;
  if (!approval) return "";
  if (approval.kind === "cancellation") {
    cancelOrder(order.id, approval.note || "Cancelled after review");
    return "Order cancelled.";
  }
  if (approval.kind === "refund") {
    const amount = Math.min(approval.amount ?? maxRefundable(order), maxRefundable(order));
    if (amount <= 0) return "Nothing left to refund on this order.";
    if (approval.destination === "store_credit") {
      refundToStoreCredit(order.id, amount);
      return `${rupees(amount)} added to store credit.`;
    }
    return (await refundThroughGateway(order.id, amount)) || `Refund of ${rupees(amount)} started.`;
  }
  const request = getReturnRequest(order.id);
  if (approval.kind === "replacement" && request?.kind === "replacement" && request.status === "Pending Review") {
    reviewReplacementRequest(order.id, { accept: true, note: approval.note || "Approved after review.", by: "approver" });
    return "Replacement accepted. Create the return AWB next.";
  }
  if (approval.kind === "return" && request?.kind === "return" && request.status === "Pending Review") {
    reviewReplacementRequest(order.id, { accept: true, note: approval.note || "Return accepted.", by: "approver" });
    return "Return accepted and the customer emailed.";
  }
  if (approval.kind === "return" && request?.kind === "return" && request.status === "Return Requested") {
    updateReturnRequest(order.id, { status: "Return Approved" });
    return "Return approved.";
  }
  return "Approved. Finish the next step on the order.";
}

export default function ApprovalsDesk() {
  useCommerceMirror();
  const [, setTick] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    window.addEventListener("vgmf-cms", refresh);
    window.addEventListener("storage", refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("vgmf-cms", refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(timer);
    };
  }, []);
  const orders = getOrders().filter((order) => order.approval);
  const pending = orders.filter((order) => order.approval?.status === "Pending");
  const decided = orders
    .filter((order) => order.approval?.status !== "Pending")
    .sort((a, b) => String(b.approval?.decidedAt).localeCompare(String(a.approval?.decidedAt)))
    .slice(0, 30);

  const decide = async (order: Order, approve: boolean) => {
    setBusy(order.id);
    setMessage("");
    try {
      const done = approve ? await carryOut(order) : "Request rejected. The desk can see your note.";
      decideApproval(order.id, approve, notes[order.id]);
      setMessage(`Order ${order.id}: ${done}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete this.");
    } finally {
      setBusy("");
    }
  };

  const row = (order: Order, open: boolean) => {
    const approval = order.approval!;
    return (
      <li key={order.id} className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-text-primary">
            {APPROVAL_LABELS[approval.kind]}
            {approval.kind === "refund" ? ` · ${rupees(approval.amount ?? maxRefundable(order))}${approval.destination === "store_credit" ? " to store credit" : ""}` : ""}
            {" · "}
            <Link href={`/admin/commerce/orders?order=${order.id}`} className="text-burgundy underline">Order {order.id}</Link>
          </p>
          <span className="text-xs text-text-muted">{approval.status}</span>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Sent by {approval.requestedBy} · {formatDateTime(approval.requestedAt)} · {order.deliveryAddress?.fullName || order.accountEmail || ""} · {rupees(order.total)} · {order.status}
        </p>
        {approval.note ? <p className="mt-1 text-sm">Desk note: {approval.note}</p> : null}
        {open ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <TextInput placeholder="Note for the desk (optional)" value={notes[order.id] ?? ""} onChange={(event) => setNotes((all) => ({ ...all, [order.id]: event.target.value }))} />
            </div>
            <Button variant="success" disabled={busy === order.id} onClick={() => void decide(order, true)}>Approve</Button>
            <Button variant="danger" disabled={busy === order.id} onClick={() => void decide(order, false)}>Reject</Button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-text-muted">
            {approval.decidedBy ? `${approval.status} by ${approval.decidedBy}` : approval.status}
            {approval.decidedAt ? ` · ${formatDateTime(approval.decidedAt)}` : ""}
            {approval.decisionNote ? ` · ${approval.decisionNote}` : ""}
          </p>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <Panel title="Approvals" description="Cancellations, refunds, returns and replacements the desk sent for senior review. Approving carries out the action on the order.">
        {message ? <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">{message}</p> : null}
        {pending.length ? <ul className="space-y-3">{pending.map((order) => row(order, true))}</ul> : <EmptyState text="Nothing is waiting. Requests sent from an order show here." />}
      </Panel>
      {decided.length ? (
        <Panel title="Recently decided">
          <ul className="space-y-3">{decided.map((order) => row(order, false))}</ul>
        </Panel>
      ) : null}
    </div>
  );
}
