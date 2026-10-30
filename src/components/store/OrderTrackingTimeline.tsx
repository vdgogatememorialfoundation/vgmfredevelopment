"use client";

import { useEffect, useMemo, useState } from "react";
import { classNames, formatDate } from "@/lib/utils";
import { storeConfig } from "@/lib/constants";
import { getShipments } from "@/lib/admin-store";
import { pickupOtp } from "@/lib/store";
import { buildTrackingStages, isHyperlocalProvider, shipmentScans, type CourierScan } from "@/lib/order-pipeline";
import { pingLiveAgent } from "@/lib/shipping-client";
import VerticalPipeline, { type PipelineStageShape, type PipelineTone } from "@/components/tracking/VerticalPipeline";
import type { Order } from "@/types";

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export default function OrderTrackingTimeline({ order }: { order: Order }) {
  const shipment = getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled");
  const [scans, setScans] = useState<CourierScan[]>(() => shipmentScans(shipment));
  const [now, setNow] = useState<Date | null>(null);
  const hyperlocal = isHyperlocalProvider(shipment?.provider ?? order.courierChoice?.provider);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setNow(new Date());
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!shipment || order.status === "Cancelled") return;
    let cancelled = false;
    const run = async () => {
      try {
        const result = await pingLiveAgent(shipment.id);
        if (cancelled) return;
        setScans(shipmentScans(shipment, result.events ?? []));
      } catch {
        if (!cancelled) setScans(shipmentScans(shipment));
      }
    };
    run();
    const ms = hyperlocal ? Math.max(8, 20) * 1000 : 45_000;
    const timer = window.setInterval(run, order.status === "Delivered" || order.status === "Failed" ? ms * 4 : ms);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [shipment?.id, order.status, hyperlocal]);

  const { stages } = useMemo(() => buildTrackingStages(order, scans, shipment), [order, scans, shipment]);
  const returnRequest = order.returnRequest;
  const courier = order.courierName ?? storeConfig.courierName;
  const trackingId = order.trackingId;
  const placed = new Date(order.date);
  const expectedFrom = addDays(placed, storeConfig.orderPreparationDays + 2);
  const expectedTo = addDays(placed, storeConfig.orderPreparationDays + storeConfig.defaultDeliveryDays);
  const packedStage = stages.find((stage) => stage.id === "packed");
  const shippedStage = stages.find((stage) => stage.id === "shipped");
  const deliveredStage = stages.find((stage) => stage.id === "delivered" || stage.id === "picked");
  const dispatchedAt = packedStage?.events[packedStage.events.length - 1]?.at;
  const shippedAt = shippedStage?.events[0]?.at;
  const deliveredAt = deliveredStage?.events[deliveredStage.events.length - 1]?.at;
  const failed = order.status === "Failed" || stages.some((stage) => stage.id === "failed" && stage.reached);
  const partialIdx = stages.findIndex((stage) => stage.partial);
  const lastReachedIdx = stages.map((stage) => stage.reached).lastIndexOf(true);
  const nodeCurrentIdx = partialIdx !== -1 ? partialIdx : order.status === "Delivered" ? lastReachedIdx : lastReachedIdx;

  const stageTiming = (stage: PipelineStageShape): { label: string; tone: PipelineTone } | null => {
    const nowTime = now?.getTime();
    if (stage.id === "failed") return { label: "Failed", tone: "red" };
    if (stage.id === "shipped" || stage.id === "out") {
      if (!stage.reached || !nowTime) return null;
      return nowTime > expectedTo.getTime() ? { label: "Delayed", tone: "red" } : { label: "On time", tone: "sky" };
    }
    if (stage.id === "delivered") {
      if (!stage.reached || !deliveredAt) return null;
      const deliveredTime = new Date(deliveredAt).getTime();
      return deliveredTime < expectedFrom.getTime()
        ? { label: "Arriving early", tone: "emerald" }
        : deliveredTime <= expectedTo.getTime()
          ? { label: "On time", tone: "sky" }
          : { label: "Delayed", tone: "red" };
    }
    return null;
  };

  const stageDateLine = (stage: PipelineStageShape): string => {
    switch (stage.id) {
      case "ordered":
        return `Ordered on ${formatDate(order.date)}`;
      case "packed":
        return stage.reached && dispatchedAt
          ? `Packed on ${formatDate(dispatchedAt)}`
          : `Packing expected by ${formatDate(expectedFrom)}`;
      case "shipped":
        return stage.reached && shippedAt
          ? `Shipped on ${formatDate(shippedAt)} · Expected by ${formatDate(expectedTo)}`
          : "Moves when the courier scans a pickup";
      case "out":
        return "Moves when the courier marks out for delivery";
      case "delivered":
        return stage.reached && deliveredAt
          ? `Delivered on ${formatDate(deliveredAt)}`
          : `Delivery expected by ${formatDate(expectedTo)}`;
      case "ready":
        return stage.reached
          ? `Pickup OTP: ${pickupOtp(order.id)} · Valid ${storeConfig.pickupHoldingDays} days`
          : `Ready within ${storeConfig.orderPreparationDays} day of packing`;
      case "picked":
        return stage.reached && deliveredAt ? `Picked up on ${formatDate(deliveredAt)}` : "Awaiting collection";
      case "cancelled":
        return `Cancelled on ${formatDate(order.date)}`;
      case "failed":
        return "Courier reported a failed delivery";
      default:
        return "";
    }
  };

  const returnPipeline = returnRequest
    ? {
        stages: returnRequest.stages.map((event) => ({
          id: event.id,
          label: event.title,
          caption: event.location,
          reached: !!event.reached,
          partial: false,
          events: [event],
        })),
      }
    : null;

  return (
    <div>
      {order.deliveryMode === "delivery" && trackingId ? (
        <p className="mb-4 rounded-lg bg-warm-cream px-3 py-2 text-xs text-text-muted">
          Courier: <span className="font-semibold text-text-primary">{courier}</span> · Tracking id:{" "}
          <span className="font-mono font-semibold text-text-primary">{trackingId}</span>
          {hyperlocal ? <span> · Live hyperlocal map below</span> : <span> · National courier — map hidden, scans only</span>}
        </p>
      ) : null}

      <VerticalPipeline
        stages={stages}
        currentIndex={nodeCurrentIdx}
        failed={failed}
        metaFor={stageDateLine}
        timingFor={stageTiming}
      />

      <p className="mt-2 rounded-xl bg-warm-cream p-3 text-xs text-text-muted">
        {order.status === "Cancelled"
          ? "This order was cancelled — refund will be initiated to your original payment method within 3–5 business days."
          : failed
            ? "The courier marked this shipment as failed or returned. The pipeline stops here until a reattempt is booked."
            : order.status === "Delivered"
              ? "Delivered — confirmation received from the courier. The line stays at the last scan."
              : order.status === "Out for Delivery"
                ? "Your order is out for delivery. The line moves down only when the next courier scan arrives."
                : order.deliveryMode === "store_pickup"
                  ? "Pickup orders do not go through the courier. We will notify you on WhatsApp when your item is ready."
                  : "This pipeline moves downward only when the courier posts a scan — it does not invent hub hops."}
      </p>

      {returnPipeline && returnRequest ? (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-text-primary">
              {returnRequest.kind === "replacement" ? "Replacement tracking" : "Return tracking"}
            </p>
            <span
              className={classNames(
                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                returnRequest.status === "Refunded" || returnRequest.status === "Picked Up"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-burgundy/10 text-burgundy"
              )}
            >
              {returnRequest.status}
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
          </div>
          <div className="mt-4">
            <VerticalPipeline stages={returnPipeline.stages} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
