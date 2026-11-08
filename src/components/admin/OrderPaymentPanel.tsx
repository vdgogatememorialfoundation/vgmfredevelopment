"use client";

import { useState } from "react";
import RefundDetails from "@/components/store/RefundDetails";
import { maxRefundable, refundToStoreCredit } from "@/lib/admin-store";
import { refreshRefundStatus, refundThroughGateway } from "@/lib/payments-client";
import type { Order, RefundRecord } from "@/types";

const ghost = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50";

const stamp = (value?: string) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "";

function Fact({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="break-all text-sm text-slate-900">{value}</dd>
    </div>
  );
}

/** Payment facts, gateway refund and refund status checks for one order on the payments and refunds desks. */
export default function OrderPaymentPanel({ order, onChange }: { order: Order; onChange: () => void }) {
  const cap = maxRefundable(order);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const gateway = Boolean(order.razorpayPaymentId);
  const paid = order.paymentStatus === "Paid" || order.paymentStatus === "Partially Refunded";

  const run = async (key: string, work: () => Promise<string> | string) => {
    setBusy(key);
    setNote("");
    try {
      setNote(await work());
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not complete that.");
    } finally {
      setBusy("");
      onChange();
    }
  };

  const value = () => {
    const typed = Number(amount);
    return amount.trim() && typed > 0 ? Math.min(typed, cap) : cap;
  };

  const check = (refund: RefundRecord) => void run(refund.id, () => refreshRefundStatus(order.id, refund.id));

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Fact label="Payment method" value={order.paymentMethod || "—"} />
        <Fact label="Paid at" value={stamp(order.paidAt)} />
        <Fact label="Gateway order ID" value={order.razorpayOrderId} />
        <Fact label="Gateway payment ID" value={order.razorpayPaymentId} />
        <Fact label="Payment reference" value={order.paymentRef} />
        <Fact label="Subtotal" value={`₹${order.subtotal.toLocaleString("en-IN")}`} />
        <Fact label="Shipping" value={`₹${(order.shipping ?? 0).toLocaleString("en-IN")}`} />
        <Fact label="GST" value={`₹${(order.gst ?? 0).toLocaleString("en-IN")}`} />
        <Fact label="Discount" value={order.discount ? `₹${order.discount.toLocaleString("en-IN")}` : ""} />
        <Fact label="Courier charge paid" value={order.courierUpgrade?.paidAt ? `₹${order.courierUpgrade.amount.toLocaleString("en-IN")}${order.courierUpgrade.paymentRef ? ` · ${order.courierUpgrade.paymentRef}` : ""}` : ""} />
        <Fact label="Refunded" value={order.refundAmount ? `₹${order.refundAmount.toLocaleString("en-IN")}` : ""} />
        <Fact label="Still refundable" value={paid ? `₹${cap.toLocaleString("en-IN")}` : ""} />
      </dl>
      {paid && cap > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
            placeholder={`Amount (max ₹${cap})`}
            className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
          />
          <button type="button" className={ghost} disabled={Boolean(busy)} onClick={() => void run("refund", () => refundThroughGateway(order.id, value()))}>
            {busy === "refund" ? "Refunding…" : gateway ? "Refund via Razorpay" : "Record refund"}
          </button>
          <button type="button" className={ghost} disabled={Boolean(busy)} onClick={() => void run("credit", () => (refundToStoreCredit(order.id, value()), "Store credit issued."))}>
            Refund to store credit
          </button>
          {!gateway ? <span className="text-xs text-slate-500">No gateway payment on this order — pay it back by hand and record it here.</span> : null}
        </div>
      ) : null}
      {note ? <p className="mt-2 text-xs font-semibold text-slate-700">{note}</p> : null}
      <RefundDetails order={order} onCheck={check} busyId={busy} />
    </div>
  );
}
