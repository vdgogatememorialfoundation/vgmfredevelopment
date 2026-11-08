import type { Order, RefundRecord } from "@/types";

const stamp = (value?: string) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "";

export function refundStateLabel(refund: RefundRecord) {
  if (refund.destination === "store_credit") return "Added to store credit";
  if (!refund.gatewayRefundId) return "Recorded by the Foundation";
  if (refund.status === "processed") return "Processed by the bank";
  if (refund.status === "failed") return "Failed";
  return "Initiated · with the bank";
}

const tone = (refund: RefundRecord) =>
  refund.status === "failed" ? "text-red-700 bg-red-50" : refund.status === "processed" || refund.destination === "store_credit" ? "text-emerald-700 bg-emerald-50" : "text-amber-800 bg-amber-50";

function Fact({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="break-all text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

/** Initiated → With the bank → Credited, like order tracking; a step fills only when the gateway reports it. */
function RefundSteps({ refund }: { refund: RefundRecord }) {
  if (refund.destination === "store_credit" || !refund.gatewayRefundId) return null;
  const failed = refund.status === "failed";
  const done = refund.status === "processed";
  const steps = [
    { label: "Refund initiated", at: stamp(refund.at), reached: true },
    { label: "With the bank", at: refund.rrn || refund.arn || refund.utr ? `Ref ${refund.rrn || refund.arn || refund.utr}` : "", reached: true },
    { label: failed ? "Refund failed" : "Credited to your account", at: stamp(refund.processedAt), reached: done || failed },
  ];
  const current = done || failed ? 2 : 1;
  return (
    <ol className="mt-3 flex items-start">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
          {index > 0 ? (
            <span className="absolute right-1/2 top-[5px] h-0.5 w-full overflow-hidden rounded-full bg-slate-200">
              <span className={`absolute inset-y-0 left-0 ${failed && index === 2 ? "bg-red-500" : "bg-emerald-600"} transition-[width] duration-700`} style={{ width: index <= current ? "100%" : "0%" }} />
            </span>
          ) : null}
          <span
            className={`relative z-10 h-3 w-3 rounded-full ${step.reached ? (failed && index === 2 ? "bg-red-500" : "bg-emerald-600") : "bg-slate-200"} ${
              index === current && !done && !failed ? "vgmf-dot-pulse" : ""
            }`}
          />
          <span className="mt-1.5 text-[11px] font-semibold text-slate-800">{step.label}</span>
          {step.at ? <span className="break-all text-[10px] text-slate-500">{step.at}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** Refund status and the bank references the gateway returned (RRN/ARN/UTR), for customers and the desk. */
export default function RefundDetails({
  order,
  onCheck,
  busyId,
}: {
  order: Order;
  onCheck?: (refund: RefundRecord) => void;
  busyId?: string;
}) {
  const refunds = order.refunds ?? [];
  if (!refunds.length) return null;
  const total = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Refunds</h3>
        <p className="text-xs text-slate-600">₹{total.toLocaleString("en-IN")} refunded · {order.paymentStatus}</p>
      </div>
      <ul className="mt-3 space-y-3">
        {refunds.map((refund) => (
          <li key={refund.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">₹{refund.amount.toLocaleString("en-IN")}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone(refund)}`}>{refundStateLabel(refund)}</span>
            </div>
            <RefundSteps refund={refund} />
            <dl className="mt-2 grid gap-2 sm:grid-cols-3">
              <Fact label="Initiated" value={stamp(refund.at)} />
              <Fact label="Processed" value={stamp(refund.processedAt)} />
              <Fact label="Refund to" value={refund.destination === "store_credit" ? "Store credit" : refund.method || order.paymentMethod || "Original payment method"} />
              <Fact label="Refund ID" value={refund.gatewayRefundId || refund.reference} />
              <Fact label="Bank RRN" value={refund.rrn} />
              <Fact label="ARN" value={refund.arn} />
              <Fact label="UTR" value={refund.utr} />
              <Fact label="Speed" value={refund.speed ? refund.speed[0].toUpperCase() + refund.speed.slice(1) : ""} />
              <Fact label="Last checked" value={stamp(refund.checkedAt)} />
            </dl>
            {refund.gatewayRefundId && refund.status !== "processed" && refund.status !== "failed" && !refund.rrn && !refund.arn ? (
              <p className="mt-2 text-xs text-slate-600">The bank reference (RRN/ARN) shows here once the bank processes the refund, usually within 5–7 working days.</p>
            ) : null}
            {onCheck && refund.gatewayRefundId ? (
              <button type="button" disabled={busyId === refund.id} onClick={() => onCheck(refund)} className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                {busyId === refund.id ? "Checking…" : "Check status with gateway"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
