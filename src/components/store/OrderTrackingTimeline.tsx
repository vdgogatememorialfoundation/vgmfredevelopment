"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";
import { storeConfig } from "@/lib/constants";
import { getShipments } from "@/lib/admin-store";
import { pickupOtp } from "@/lib/store";
import { buildTrackingStages, isHyperlocalProvider, shipmentScans, type CourierScan } from "@/lib/order-pipeline";
import { pingLiveAgent } from "@/lib/shipping-client";
import VerticalPipeline, { type PipelineStageShape, type PipelineTone } from "@/components/tracking/VerticalPipeline";
import LiveTracking from "@/components/store/LiveTracking";
import type { Order } from "@/types";

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export default function OrderTrackingTimeline({ order }: { order: Order }) {
  const shipment = getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled");
  const [scans, setScans] = useState<CourierScan[]>(() => shipmentScans(shipment));
  const hyperlocal = isHyperlocalProvider(shipment?.provider ?? order.courierChoice?.provider);

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

  const { stages: rawStages } = useMemo(() => buildTrackingStages(order, scans, shipment), [order, scans, shipment]);
  const returnRequest = order.returnRequest;
  const courier = order.courierName ?? storeConfig.courierName;
  const trackingId = order.trackingId;
  const placed = new Date(order.date);
  const expectedFrom = addDays(placed, storeConfig.orderPreparationDays + 2);
  const expectedTo = addDays(placed, storeConfig.orderPreparationDays + storeConfig.defaultDeliveryDays);
  const packedStage = rawStages.find((stage) => stage.id === "packed");
  const shippedStage = rawStages.find((stage) => stage.id === "shipped");
  const deliveredStage = rawStages.find((stage) => stage.id === "delivered" || stage.id === "picked");
  const dispatchedAt = packedStage?.events[packedStage.events.length - 1]?.at;
  const shippedAt = shippedStage?.events[0]?.at;
  const deliveredAt = deliveredStage?.events[deliveredStage.events.length - 1]?.at;
  const failed = order.status === "Failed" || rawStages.some((stage) => stage.id === "failed" && stage.reached);
  const partialIdx = rawStages.findIndex((stage) => stage.partial);
  const lastReachedIdx = rawStages.map((stage) => stage.reached).lastIndexOf(true);
  const nodeCurrentIdx = partialIdx !== -1 ? partialIdx : lastReachedIdx;

  const stages: PipelineStageShape[] = rawStages.map((stage) => {
    const next: PipelineStageShape = { ...stage };
    if (stage.id === "shipped" && (trackingId || courier) && stage.reached) {
      next.courierNote = {
        title: courier,
        detail: `${hyperlocal ? "Hyperlocal" : "Logistics"}${trackingId ? ` · Tracking ID ${trackingId}` : ""}`,
      };
    }
    if (stage.id === "packed" && !stage.reached) next.expected = `Packing expected by ${formatDate(expectedFrom)}`;
    if (stage.id === "delivered" && !stage.reached) next.expected = `Delivery expected by ${formatDate(expectedTo)}`;
    if (stage.id === "ready" && stage.reached) next.caption = `Pickup OTP: ${pickupOtp(order.id)}`;
    return next;
  });

  const stageTiming = (stage: PipelineStageShape): { label: string; tone: PipelineTone } | null => {
    if (stage.id === "failed") return { label: "Failed", tone: "red" };
    if (stage.id === "shipped" || stage.id === "out") {
      if (!stage.reached) return null;
      return Date.now() > expectedTo.getTime() ? { label: "Delayed", tone: "red" } : { label: "On time", tone: "emerald" };
    }
    if (stage.id === "delivered" && stage.reached && deliveredAt) {
      const deliveredTime = new Date(deliveredAt).getTime();
      return deliveredTime < expectedFrom.getTime()
        ? { label: "Arriving early", tone: "emerald" }
        : deliveredTime <= expectedTo.getTime()
          ? { label: "On time", tone: "emerald" }
          : { label: "Delayed", tone: "red" };
    }
    return null;
  };

  const stageDateLine = (stage: PipelineStageShape): string => {
    switch (stage.id) {
      case "ordered":
        return formatDate(order.date);
      case "packed":
        return stage.reached && dispatchedAt ? formatDate(dispatchedAt) : "";
      case "shipped":
        return stage.reached && shippedAt ? formatDate(shippedAt) : "";
      case "out":
        return stage.reached ? "Out for delivery" : "";
      case "delivered":
        return stage.reached && deliveredAt ? formatDate(deliveredAt) : "";
      case "ready":
        return stage.reached ? `OTP ${pickupOtp(order.id)}` : "";
      case "picked":
        return stage.reached && deliveredAt ? formatDate(deliveredAt) : "";
      case "cancelled":
        return formatDate(order.date);
      case "failed":
        return "Delivery failed";
      default:
        return "";
    }
  };

  const lineNote =
    order.status === "Cancelled"
      ? "This order was cancelled — refund will be initiated to your original payment method within 3–5 business days."
      : failed
        ? "The line stays on Failed until a reattempt is booked."
        : order.status === "Delivered"
          ? "Delivered — confirmation received from the courier."
          : order.status === "Out for Delivery"
            ? "The line moves down through the delivery window, and it stops before Delivered."
            : order.deliveryMode === "store_pickup"
              ? "Pickup orders do not go through the courier."
              : "The line moves down from the top and pauses on the latest courier scan.";

  const pipe = (
    <VerticalPipeline
      stages={stages}
      currentIndex={nodeCurrentIdx}
      failed={failed}
      metaFor={stageDateLine}
      timingFor={stageTiming}
      note={lineNote}
    />
  );

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
    <div className="vgmf-trk">
      {order.deliveryMode === "delivery" && hyperlocal ? (
        <div className="vgmf-hl">
          <div className="vgmf-hl-sheet">{pipe}</div>
          <div className="vgmf-hl-map">
            <LiveTracking order={order} embedded />
          </div>
        </div>
      ) : (
        pipe
      )}

      {returnPipeline && returnRequest ? (
        <div className="mt-6">
          <p className="vgmf-trk-note">
            {returnRequest.kind === "replacement" ? "Replacement tracking" : "Return tracking"} · {returnRequest.status}
          </p>
          <VerticalPipeline stages={returnPipeline.stages} />
        </div>
      ) : null}
    </div>
  );
}
