"use client";

import { Fragment, useEffect, useState } from "react";
import { getShipments } from "@/lib/admin-store";
import { rememberOrder, rememberShipment } from "@/lib/commerce-sync";
import { buildTrackingStages, shipmentScans, type TrackingStageId } from "@/lib/order-pipeline";
import { agreedDelivery, clockZone, deliveryExpectation } from "@/lib/delivery-expectation";
import type { Order, ShipmentRecord } from "@/types";
import { REFUND_CREDIT_NOTE, refundExpectedCredit, refundExpectedCreditLabel } from "@/components/store/RefundDetails";

const STAGE_STATUS: Partial<Record<TrackingStageId, Order["status"]>> = {
  packed: "Packed",
  ready: "Packed",
  shipped: "Shipped",
  out: "Out for Delivery",
  delivered: "Delivered",
  picked: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled",
  "cancel-review": "Cancelled",
  refunded: "Cancelled",
};

const STEPS = ["Ordered", "Packed", "Shipped", "Out for delivery", "Delivered"];
const STEP_OF: Partial<Record<Order["status"], number>> = {
  Packed: 1,
  "Ready to Ship": 1,
  "To Ship": 1,
  Shipped: 2,
  "Out for Delivery": 3,
  Delivered: 4,
};

const FINAL = new Set<Order["status"]>(["Delivered", "Cancelled", "Failed"]);

function shortStamp(at: string | undefined, country?: string) {
  if (!at) return "";
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: clockZone(country),
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function dayLabel(at: string | undefined, country?: string) {
  const ms = Date.parse(at ?? "");
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: clockZone(country),
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(ms));
}

/** Collapsed My Orders card: headline, latest scan and a mini progress bar that follow the order's live status. */
export default function OrderTrackingPreview({ order, live = true }: { order: Order; live?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const shipment: ShipmentRecord | undefined = getShipments().find(
    (item) => item.orderId === order.id && item.note !== "Cancelled"
  );
  const { stages } = buildTrackingStages(order, shipmentScans(shipment), shipment);
  const partialIdx = stages.map((stage) => stage.partial).lastIndexOf(true);
  const reachedIdx = stages.map((stage) => stage.reached).lastIndexOf(true);
  const currentIdx = partialIdx !== -1 ? partialIdx : Math.max(0, reachedIdx);
  const current = stages[currentIdx];
  const fromStage = current ? STAGE_STATUS[current.id] : undefined;
  const status: Order["status"] = FINAL.has(order.status) ? order.status : fromStage ?? order.status;
  const terminal = FINAL.has(status);
  const country = order.deliveryAddress?.country;
  const pickup = order.deliveryMode === "store_pickup";
  const latest = current?.events.at(-1);

  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!live || terminal || pickup) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/shop/shipments", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "refresh", orderId: order.id }),
        });
        const data = (await response.json()) as { shipment?: ShipmentRecord; order?: Order };
        if (cancelled) return;
        if (data.shipment) rememberShipment(data.shipment);
        if (data.order) rememberOrder(data.order);
      } catch {
        /* keep the last known status */
      }
    };
    const first = window.setTimeout(refresh, 400 + Math.random() * 1600);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [order.id, live, terminal, pickup]);

  let headline: string;
  if (status === "Delivered") {
    const deliveredOn = dayLabel(latest?.at, country);
    headline = pickup
      ? `Picked up${deliveredOn ? ` on ${deliveredOn}` : ""}`
      : deliveredOn
        ? `Delivered on ${deliveredOn}`
        : "Your order is delivered";
  } else if (status === "Awaiting Confirmation") {
    headline = "Awaiting confirmation from the Foundation desk";
  } else if (pickup && current?.id === "ready") {
    headline = "Ready for pickup at the Foundation office";
  } else {
    headline = deliveryExpectation(status, agreedDelivery(order.eta, shipment?.expectedBy, Date.parse(order.date)), now, country);
  }

  const bad = status === "Failed" || status === "Cancelled";
  const good = status === "Delivered" || /today|early|out for delivery/i.test(headline);
  const tone = bad ? "text-red-700" : good ? "text-emerald-700" : "text-burgundy";
  const fill = bad ? "bg-red-600" : "bg-emerald-600";
  const detail = current?.id === "ordered" ? "Placed" : latest?.title ?? "";
  const stamp = status === "Delivered" ? dayLabel(latest?.at, country) : shortStamp(latest?.at, country);
  const stepAt = Date.parse(latest?.at || order.date);
  const dueAt = Date.parse(shipment?.expectedBy || "") || (Number.isFinite(stepAt) ? stepAt + 72 * 60 * 60 * 1000 : NaN);
  const creep =
    Number.isFinite(stepAt) && Number.isFinite(dueAt) && dueAt > stepAt
      ? Math.round(Math.min(85, Math.max(8, ((now - stepAt) / (dueAt - stepAt)) * 85)))
      : 8;
  const returnRequest = order.returnRequest && order.returnRequest.status !== "Rejected" ? order.returnRequest : undefined;
  const returnStages = returnRequest?.stages ?? [];
  const steps = returnRequest && returnStages.length
    ? returnStages.map((stage) => stage.title)
    : pickup
      ? stages.map((stage) => stage.label)
      : STEPS;
  const stepIdx = returnRequest && returnStages.length
    ? Math.max(0, returnStages.map((stage) => Boolean(stage.reached)).lastIndexOf(true))
    : pickup
      ? currentIdx
      : Math.max(STEP_OF[status] ?? 0, STEP_OF[order.status] ?? 0);
  if (returnRequest) {
    headline = `${returnRequest.kind === "replacement" ? "Replacement" : "Return"} · ${returnRequest.status}${
      returnRequest.replacementOrderId ? ` · new order ${returnRequest.replacementOrderId}` : ""
    }`;
  }

  const refunds = order.refunds ?? [];
  const refundView =
    !returnRequest && refunds.length > 0 && (order.status === "Cancelled" || order.paymentStatus === "Refunded")
      ? (() => {
          const amount = refunds.reduce((sum, refund) => sum + refund.amount, 0);
          const lastRefund = refunds[refunds.length - 1];
          const processed = refunds.every((refund) => refund.status !== "pending" && refund.status !== "failed");
          const failed = refunds.some((refund) => refund.status === "failed");
          const expected = refundExpectedCredit(lastRefund);
          const credited = processed && (lastRefund.destination === "store_credit" || Boolean(expected?.done));
          const bankRef = lastRefund.arn || lastRefund.rrn || lastRefund.utr;
          const rupee = `₹${amount.toLocaleString("en-IN")}`;
          const startAt =
            order.status === "Cancelled"
              ? (order.history ?? []).find((entry) => entry.status === "Cancelled")?.at ?? order.date
              : order.date;
          const creditDay = expected && !failed ? dayLabel(expected.date.toISOString(), country) : "";
          return {
            stamps: [
              shortStamp(startAt, country),
              shortStamp(lastRefund.at, country),
              failed ? "Failed" : shortStamp(lastRefund.processedAt, country),
              credited ? shortStamp(expected?.date.toISOString(), country) : creditDay ? `by ${creditDay}` : "",
            ],
            steps: [order.status === "Cancelled" ? "Cancelled" : "Ordered", "Refund initiated", "Processed", "Credited"],
            index: credited ? 3 : processed ? 2 : 1,
            failed,
            headline: failed
              ? `Refund of ${rupee} needs attention · the Foundation desk will contact you`
              : credited
                ? `${rupee} refunded${lastRefund.destination === "store_credit" ? " to store credit" : " to your account"}`
                : processed
                  ? `Refund of ${rupee} processed · ${refundExpectedCreditLabel(lastRefund).toLowerCase() || "credit within 5–7 working days"}`
                  : `Refund of ${rupee} initiated`,
            detail: [
              shortStamp(lastRefund.processedAt || lastRefund.at, country),
              !failed && !credited ? refundExpectedCreditLabel(lastRefund) : "",
              processed && !failed && !credited && lastRefund.destination !== "store_credit" ? REFUND_CREDIT_NOTE : "",
              bankRef ? `Bank ref ${bankRef}` : "",
              lastRefund.gatewayRefundId ? `Refund ID ${lastRefund.gatewayRefundId}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
          };
        })()
      : undefined;
  const shownSteps = refundView ? refundView.steps : steps;
  const shownIdx = refundView ? refundView.index : stepIdx;
  const shownTerminal = refundView ? refundView.index === 3 || refundView.failed : terminal;
  const shownFill = refundView ? (refundView.failed ? "bg-red-600" : "bg-emerald-600") : fill;
  const shownTone = refundView ? (refundView.failed ? "text-red-700" : "text-emerald-700") : tone;
  if (refundView) headline = refundView.headline;
  const shownDetail = refundView ? refundView.detail : [detail, stamp].filter(Boolean).join(" · ");

  return (
    <span className="mt-1 block" data-order-preview={order.id}>
      <span className={`block text-sm font-semibold ${shownTone}`}>{headline}</span>
      {shownDetail && <span className="mt-0.5 block truncate text-xs text-text-muted">{shownDetail}</span>}
      <span className="mt-2.5 flex items-center" aria-label={`Progress: ${shownSteps[shownIdx] ?? status}`}>
        {shownSteps.map((label, index) => (
          <Fragment key={label}>
            {index > 0 ? (
              <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                <span
                  className={`absolute inset-y-0 left-0 ${shownFill} transition-[width] ease-linear`}
                  style={{
                    width: !shown ? "0%" : index <= shownIdx ? "100%" : index === shownIdx + 1 && !shownTerminal ? `${creep}%` : "0%",
                    transitionDuration: index <= shownIdx ? "450ms" : "60s",
                    transitionDelay: `${index <= shownIdx ? (index - 1) * 450 : shownIdx * 450}ms`,
                  }}
                />
              </span>
            ) : null}
            <span
              title={label}
              className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${index <= shownIdx && (shown || index === 0) ? shownFill : "bg-border"} ${
                index === shownIdx && !shownTerminal ? "vgmf-dot-pulse" : ""
              }`}
              style={{ transitionDelay: `${Math.max(0, index) * 450}ms` }}
            />
          </Fragment>
        ))}
      </span>
      <span className="mt-1 flex justify-between gap-1 text-[10px] font-medium leading-tight text-text-muted">
        {shownSteps.map((label, index) => (
          <span
            key={label}
            className={`${index === 0 ? "text-left" : index === shownSteps.length - 1 ? "text-right" : "text-center"} ${index === shownIdx ? shownTone : ""}`}
          >
            {label}
            {refundView?.stamps[index] ? <span className="block font-normal text-text-muted">{refundView.stamps[index]}</span> : null}
          </span>
        ))}
      </span>
    </span>
  );
}
