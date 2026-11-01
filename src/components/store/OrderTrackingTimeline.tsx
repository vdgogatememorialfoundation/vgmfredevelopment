"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";
import { parseExpected, statusStamp } from "@/lib/delivery-expectation";
import { storeConfig } from "@/lib/constants";
import { getShipments } from "@/lib/admin-store";
import { pickupOtp } from "@/lib/store";
import { rememberOrder, rememberShipment } from "@/lib/commerce-sync";
import { aggregatorName, customerCourierLabel } from "@/lib/courier-label";
import { getIntegrations } from "@/lib/integrations";
import { buildTrackingStages, isHyperlocalProvider, shipmentScans, type CourierScan } from "@/lib/order-pipeline";
import { pingLiveAgent } from "@/lib/shipping-client";
import VerticalPipeline, { type PipelineStageShape, type PipelineTone } from "@/components/tracking/VerticalPipeline";
import LiveTracking from "@/components/store/LiveTracking";
import type { Order, ShipmentRecord } from "@/types";

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="vgmf-trk-tile">
      <b>{label}</b>
      <span>{value}</span>
    </div>
  );
}

export default function OrderTrackingTimeline({ order, phone = "" }: { order: Order; phone?: string }) {
  const localShipment = getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled") ?? null;
  const [remote, setRemote] = useState<ShipmentRecord | null>(null);
  const shipment = remote ?? localShipment;
  const provider = shipment?.provider ?? order.courierChoice?.provider;
  const hyperlocal = isHyperlocalProvider(provider, order.courierChoice?.lastMile);
  const [scans, setScans] = useState<CourierScan[]>(() => shipmentScans(shipment));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch("/api/shop/shipments", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "refresh", orderId: order.id, phone }),
        });
        const data = (await response.json()) as {
          ok?: boolean;
          live?: boolean;
          shipment?: ShipmentRecord;
          order?: Order;
        };
        if (cancelled) return;
        if (data.shipment) {
          setRemote(data.shipment);
          rememberShipment(data.shipment);
          setScans(shipmentScans(data.shipment));
        }
        if (data.order) rememberOrder(data.order);
        if (data.live) return;
      } catch {
        /* try the courier keys saved on this browser */
      }
      const local = getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled");
      if (!local?.id || cancelled) return;
      try {
        const result = await pingLiveAgent(local.id);
        if (cancelled) return;
        const updated = getShipments().find((item) => item.id === local.id) ?? local;
        setRemote(updated);
        setScans(shipmentScans(updated, result.events ?? []));
      } catch {
        if (!cancelled) setScans(shipmentScans(local));
      }
    };
    void run();
    const terminal = order.status === "Delivered" || order.status === "Cancelled" || order.status === "Failed";
    const ping = Math.min(10, Math.max(8, getIntegrations().shipping.hyperlocalPingSeconds || 8));
    const ms = terminal ? 120_000 : hyperlocal ? ping * 1000 : 45_000;
    const timer = window.setInterval(run, ms);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [order.id, order.status, phone, hyperlocal]);

  const shownScans = scans.map((scan, index, list) =>
    index === list.length - 1 && (shipment?.agentName || shipment?.agentPhone)
      ? { ...scan, agent: { name: shipment.agentName, phone: shipment.agentPhone }, otp: shipment.deliveryOtp || scan.otp }
      : scan
  );
  const { stages: rawStages } = useMemo(() => buildTrackingStages(order, shownScans, shipment), [order, shownScans, shipment]);
  const returnRequest = order.returnRequest;
  const courier = customerCourierLabel({ provider, courier: shipment?.courier || order.courierName });
  const via = aggregatorName(provider);
  const trackingId = shipment?.awb || order.trackingId || "";
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
  const partialIdx = rawStages.map((stage) => stage.partial).lastIndexOf(true);
  const lastReachedIdx = rawStages.map((stage) => stage.reached).lastIndexOf(true);
  const nodeCurrentIdx = partialIdx !== -1 ? partialIdx : lastReachedIdx;
  const pickupDone = hyperlocal
    ? rawStages.some((stage) => stage.id === "out" && stage.reached)
    : Boolean(shippedStage?.reached);

  const stages: PipelineStageShape[] = rawStages.map((stage) => {
    const next: PipelineStageShape = { ...stage };
    if (stage.id === "shipped" && (trackingId || courier) && stage.reached) {
      const viaNote = via && via !== courier ? `via ${via}` : hyperlocal ? "Hyperlocal" : "Logistics";
      next.courierNote = {
        title: courier,
        detail: [viaNote, trackingId ? `Tracking ID ${trackingId}` : ""].filter(Boolean).join(" · "),
      };
    }
    if (stage.id === "packed" && !stage.reached) next.expected = `Packing expected by ${formatDate(expectedFrom)}`;
    if (stage.id === "delivered" && !stage.reached) {
      next.expected = shipment?.expectedBy ? `Courier delivery ${shipment.expectedBy}` : "Waiting for the courier";
    }
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
        return statusStamp(order.date);
      case "packed":
        return stage.reached && dispatchedAt ? statusStamp(dispatchedAt) : "";
      case "shipped":
        return stage.reached && shippedAt ? statusStamp(shippedAt) : "";
      case "out":
        return stage.reached ? statusStamp(stage.events.at(-1)?.at) || "Out for delivery" : "";
      case "delivered":
        return stage.reached && deliveredAt ? statusStamp(deliveredAt) : "";
      case "ready":
        return stage.reached ? `OTP ${pickupOtp(order.id)}` : "";
      case "picked":
        return stage.reached && deliveredAt ? statusStamp(deliveredAt) : "";
      case "cancel-review":
        return "Reviewed by admin";
      case "cancelled":
        return statusStamp(order.history?.find((item) => /cancel/i.test(item.status))?.at || order.date);
      case "refunded":
        return order.refundAmount ? `₹${order.refundAmount.toLocaleString("en-IN")}` : "";
      case "failed":
        return "Delivery failed";
      default:
        return "";
    }
  };

  const lineNote =
    order.status === "Cancelled"
      ? "This order was cancelled by the Foundation desk. Follow the cancellation steps below — customers cannot cancel from their account."
      : failed
        ? "The line stays on Failed until a reattempt is booked."
        : order.status === "Delivered"
          ? "Delivered — confirmation received from the courier."
          : order.status === "Out for Delivery"
            ? "The line moves down through the delivery window, and it stops before Delivered."
            : order.deliveryMode === "store_pickup"
              ? "Pickup orders do not go through the courier."
              : hyperlocal
                ? ""
                : "The line runs from the top to the latest green step. The tracking number appears when Shipped turns green.";

  const stepStamp = Date.parse(rawStages[nodeCurrentIdx]?.events.at(-1)?.at || order.date);
  const paceFrom = Number.isFinite(stepStamp) ? stepStamp : placed.getTime();
  const promisedAt = parseExpected(shipment?.expectedBy, paceFrom);
  const paceUntil = promisedAt && promisedAt > paceFrom + 60_000 ? promisedAt : paceFrom + (hyperlocal ? 8 : 72) * 60 * 60 * 1000;
  const latestTitle = rawStages[nodeCurrentIdx]?.events.at(-1)?.title ?? "";
  const facilityStatus = /^(Pickup scheduled|Shipment arrived at courier facility|Shipment left courier facility)/.test(latestTitle);
  const currentStatus = facilityStatus ? latestTitle : rawStages[nodeCurrentIdx]?.label || order.status;

  const pipe = (
    <VerticalPipeline
      stages={stages}
      currentIndex={nodeCurrentIdx}
      failed={failed}
      metaFor={stageDateLine}
      timingFor={stageTiming}
      note={lineNote}
      pace={failed || order.status === "Delivered" ? null : { from: paceFrom, until: paceUntil }}
    />
  );

  const tiles = (
    <div className="vgmf-trk-tiles">
      <Tile label="Order" value={order.id} />
      <Tile label="Date" value={formatDate(order.date)} />
      <Tile label="Status" value={currentStatus} />
      {pickupDone ? <Tile label="Courier" value={via && via !== courier ? `${courier} · via ${via}` : courier} /> : null}
      {pickupDone && shipment?.agentPhone ? <Tile label="Rider" value={[shipment.agentName, shipment.agentPhone].filter(Boolean).join(" · ")} /> : null}
      {shipment?.deliveryOtp ? <Tile label="Delivery OTP" value={shipment.deliveryOtp} /> : null}
      {order.deliveryMode === "store_pickup" ? <Tile label="Pickup OTP" value={pickupOtp(order.id)} /> : null}
    </div>
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
      {tiles}
      {order.deliveryMode === "delivery" ? (
        <div className="vgmf-hl">
          <div className="vgmf-hl-sheet">{pipe}</div>
          <div className="vgmf-hl-map">
            <LiveTracking order={order} shipment={shipment} />
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
