import VerticalPipeline, { type PipelineStageShape } from "@/components/tracking/VerticalPipeline";
import type { Order, RefundRecord } from "@/types";

const stamp = (value?: string) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "";

function addWorkingDays(from: number, days: number) {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return date;
}

export const REFUND_CREDIT_NOTE = "The amount will be credited to your bank account within 5–7 working days after the refund is processed. If it has not arrived by then, please contact your bank.";

/** Credited 7 working days after Razorpay processes the refund (about 3–5 to process first). */
export function refundExpectedCredit(refund: RefundRecord): { date: Date; done: boolean } | null {
  if (refund.status === "failed") return null;
  if (refund.destination === "store_credit") {
    const at = Date.parse(refund.at);
    return Number.isFinite(at) ? { date: new Date(at), done: true } : null;
  }
  const processed = Date.parse(refund.processedAt || "");
  const base = Number.isFinite(processed) ? processed : Date.parse(refund.at);
  if (!Number.isFinite(base)) return null;
  const date = addWorkingDays(base, Number.isFinite(processed) ? 7 : refund.speed === "optimum" ? 1 : 12);
  return { date, done: Date.now() >= date.getTime() };
}

/** When Razorpay usually finishes processing a refund (3–5 working days after it is initiated). */
export function refundProcessingDue(refund: RefundRecord) {
  const at = Date.parse(refund.at);
  return Number.isFinite(at) ? addWorkingDays(at, 5).getTime() : NaN;
}

export function refundExpectedCreditLabel(refund: RefundRecord) {
  const expected = refundExpectedCredit(refund);
  if (!expected) return "";
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(expected.date);
  if (refund.destination === "store_credit") return `Credited ${day}`;
  return expected.done ? `Should have been credited by ${day}` : `Expected credit by ${day}`;
}

export function refundStateLabel(refund: RefundRecord) {
  if (refund.destination === "store_credit") return "Added to store credit";
  if (!refund.gatewayRefundId) return "Recorded by the Foundation";
  if (refund.status === "processed") return refundExpectedCredit(refund)?.done ? "Credited" : "Refund processed";
  if (refund.status === "failed") return "Failed";
  return "Refund processing";
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

/** The line creeps by the clock: initiated → processing estimate, then processed → expected credit date. */
function refundPace(refund: RefundRecord) {
  if (refund.status === "failed" || refund.destination === "store_credit" || !refund.gatewayRefundId) return null;
  const processed = Date.parse(refund.processedAt || "");
  if (refund.status === "processed" && Number.isFinite(processed)) {
    const expected = refundExpectedCredit(refund);
    return expected && !expected.done ? { from: processed, until: expected.date.getTime() } : null;
  }
  const from = Date.parse(refund.at);
  const until = refundProcessingDue(refund);
  return Number.isFinite(from) && Number.isFinite(until) ? { from, until } : null;
}

/** Initiated → Processing → Processed, drawn with the same dots-and-line pipeline as order tracking. */
function RefundSteps({ refund }: { refund: RefundRecord }) {
  const failed = refund.status === "failed";
  const credit = refund.destination === "store_credit";
  const manual = !credit && !refund.gatewayRefundId;
  const done = credit || refund.status === "processed";
  const bankRef = refund.rrn || refund.arn || refund.utr;
  const stages: PipelineStageShape[] = [
    { id: "initiated", label: "Refund initiated", caption: `₹${refund.amount.toLocaleString("en-IN")}`, reached: true, partial: false, events: [] },
    credit
      ? { id: "refunded", label: "Added to store credit", caption: "Use it on your next order.", reached: true, partial: false, events: [] }
      : manual
        ? { id: "recorded", label: "Recorded by the Foundation", caption: "Paid back through the original payment method.", reached: true, partial: false, events: [] }
        : { id: "bank", label: "Refund processing", caption: "Takes 3–5 working days.", reached: true, partial: false, events: [] },
    ...(credit
      ? []
      : [
          {
            id: failed ? "failed" : "processed",
            label: failed ? "Refund failed" : "Refund processed",
            caption: failed
              ? stamp(refund.checkedAt)
              : bankRef ? `Bank reference ${bankRef}` : "",
            reached: done || failed || manual,
            partial: false,
            events: [],
          },
          ...(failed || manual
            ? []
            : [
                {
                  id: "credited",
                  label: "Credited to your account",
                  caption: REFUND_CREDIT_NOTE,
                  reached: Boolean(done && refundExpectedCredit(refund)?.done),
                  partial: false,
                  events: [],
                },
              ]),
        ]),
  ];
  const current = stages.map((stage) => stage.reached).lastIndexOf(true);
  // The step the refund is waiting on pulses live, like the order tracker's current step.
  if (!failed && current < stages.length - 1) stages[current] = { ...stages[current], partial: true };
  const expected = refundExpectedCredit(refund);
  const day = (value?: Date) =>
    value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(value) : "";
  const metaFor = (stage: PipelineStageShape) =>
    stage.id === "initiated"
      ? stamp(refund.at)
      : stage.id === "processed" || stage.id === "failed"
        ? stamp(failed ? refund.checkedAt : refund.processedAt)
        : stage.id === "credited" && stage.reached
          ? day(expected?.date)
          : "";
  return (
    <div className="mt-2">
      <VerticalPipeline stages={stages} currentIndex={current} failed={failed} pace={refundPace(refund)} metaFor={metaFor} />
    </div>
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
              <Fact label="Expected credit" value={refundExpectedCreditLabel(refund).replace(/^(Expected credit by|Should have been credited by|Credited) /, "")} />
              <Fact label="Refund to" value={refund.destination === "store_credit" ? "Store credit" : refund.method || order.paymentMethod || "Original payment method"} />
              <Fact label="Refund ID" value={refund.gatewayRefundId || refund.reference} />
              <Fact label="Bank RRN" value={refund.rrn} />
              <Fact label="ARN" value={refund.arn} />
              <Fact label="UTR" value={refund.utr} />
              <Fact label="Speed" value={refund.speed ? refund.speed[0].toUpperCase() + refund.speed.slice(1) : ""} />
            </dl>
            {refund.gatewayRefundId && refund.status !== "processed" && refund.status !== "failed" && !refund.rrn && !refund.arn ? (
              <p className="mt-2 text-xs text-slate-600">The bank reference (RRN/ARN) shows here once the refund is processed, usually within 3–5 working days. This page updates on its own.</p>
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
