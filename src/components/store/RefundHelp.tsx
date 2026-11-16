"use client";

import { useState } from "react";
import { siteConfig } from "@/lib/constants";
import type { RefundRecord } from "@/types";

/** "How to check my refund": the steps, with this refund's own reference numbers. */
export default function RefundHelp({ refund, orderId }: { refund: RefundRecord; orderId: string }) {
  const [open, setOpen] = useState(false);
  if (refund.destination === "store_credit") return null;
  const bankRef = refund.rrn || refund.arn || refund.utr;
  const refs = [
    refund.vgmfId && ["VGMF transaction ID", refund.vgmfId],
    refund.gatewayRefundId && ["Refund ID", refund.gatewayRefundId],
    bankRef && ["Bank reference (RRN/ARN)", bankRef],
  ].filter(Boolean) as [string, string][];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-burgundy">
        How to check my refund
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label="How to check your refund" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 text-left shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">How to check your refund</h3>
            <p className="mt-1 text-sm text-slate-600">
              ₹{refund.amount.toLocaleString("en-IN")} for order {orderId}, to your original payment method.
            </p>
            {refs.length ? (
              <dl className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3">
                {refs.map(([label, value]) => (
                  <div key={label} className="flex flex-wrap justify-between gap-2 text-sm">
                    <dt className="text-slate-600">{label}</dt>
                    <dd className="break-all font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-800">
              <li>The refund is processed within 3–5 working days. This page updates by itself, and we email you the bank reference (RRN/ARN) when the bank issues it.</li>
              <li>Open your bank statement, and look for a credit of ₹{refund.amount.toLocaleString("en-IN")}.</li>
              <li>It is usually credited within 5–7 working days after processing.</li>
              <li>If it is not there by then, call your bank and quote the bank reference (RRN/ARN){bankRef ? ` ${bankRef}` : ""}. Banks trace refunds with this number.</li>
              <li>Still not found? Write to {siteConfig.email || "care@vaidyagogate.org"} with your order ID and VGMF transaction ID.</li>
            </ol>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-lg bg-burgundy px-3 py-2 text-sm font-semibold text-white">
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
