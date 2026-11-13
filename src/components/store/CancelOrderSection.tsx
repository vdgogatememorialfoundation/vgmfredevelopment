"use client";

import { useState } from "react";
import { canCustomerCancel, customerCancellationRefund } from "@/lib/integrations";
import { cancelMyOrder, formatPrice } from "@/lib/store";
import { useOrderSettings } from "@/lib/use-cms";
import type { Order } from "@/types";

const REASONS = ["Ordered by mistake", "Need to change items or address", "Delivery will take too long", "Bought it elsewhere", "Other"];

export default function CancelOrderSection({ order, phone }: { order: Order; phone?: string }) {
  const settings = useOrderSettings();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  if (done) {
    return <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{done}</div>;
  }
  if (!canCustomerCancel(order, settings)) return null;
  const refund = customerCancellationRefund(order, settings);
  const fee = settings.cancellation.fee;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await cancelMyOrder(order.id, reason === "Other" && note.trim() ? note.trim() : [reason, note.trim()].filter(Boolean).join(": "), phone);
      setDone(refund > 0 ? `Order cancelled. A refund of ${formatPrice(refund)} will be sent to your original payment method.` : "Order cancelled.");
      setOpen(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not cancel the order.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-text-primary">Cancel this order</h3>
      <p className="mt-1 text-xs text-text-muted">
        {refund > 0
          ? `You will get back ${formatPrice(refund)}${fee > 0 ? ` (a ${formatPrice(fee)} cancellation fee and the platform fee are kept)` : " (the platform fee is kept)"}.`
          : fee > 0 ? `A ${formatPrice(fee)} cancellation fee applies.` : "Nothing has been charged that needs a refund."}
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-lg border border-burgundy px-4 py-2 text-sm font-semibold text-burgundy transition hover:bg-burgundy hover:text-white">
          Cancel order
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-semibold text-text-muted">
            Reason
            <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary">
              {REASONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Anything else (optional)" className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy-dark disabled:opacity-60">
              {busy ? "Cancelling…" : "Yes, cancel the order"}
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">
              Keep the order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
