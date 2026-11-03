"use client";

import { useEffect, useState } from "react";
import { getShipments } from "@/lib/admin-store";
import { rememberOrder, rememberShipment } from "@/lib/commerce-sync";
import { buildTrackingStages, shipmentScans, type TrackingStageId } from "@/lib/order-pipeline";
import { clockZone, deliveryExpectation } from "@/lib/delivery-expectation";
import type { Order, ShipmentRecord } from "@/types";

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
  } else if (pickup && current?.id === "ready") {
    headline = "Ready for pickup at the Foundation office";
  } else {
    headline = deliveryExpectation(status, shipment?.expectedBy || order.eta, now, country);
  }

  const bad = status === "Failed" || status === "Cancelled";
  const good = status === "Delivered" || /today|early|out for delivery/i.test(headline);
  const tone = bad ? "text-red-700" : good ? "text-emerald-700" : "text-burgundy";
  const fill = bad ? "bg-red-600" : "bg-emerald-600";
  const detail = current?.id === "ordered" ? "Placed" : latest?.title ?? "";
  const stamp = shortStamp(latest?.at, country);

  return (
    <span className="mt-1 block" data-order-preview={order.id}>
      <span className={`block text-sm font-semibold ${tone}`}>{headline}</span>
      {(detail || stamp) && (
        <span className="mt-0.5 block truncate text-xs text-text-muted">
          {[detail, stamp].filter(Boolean).join(" · ")}
        </span>
      )}
      <span className="mt-2 flex items-center gap-1" aria-label={`Progress: ${current?.label ?? status}`}>
        {stages.map((stage, index) => (
          <span
            key={stage.id}
            title={stage.label}
            className={`h-1.5 flex-1 rounded-full ${index <= currentIdx ? fill : "bg-border"} ${
              index === currentIdx && !terminal ? "animate-pulse" : ""
            }`}
          />
        ))}
      </span>
      <span className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
        <span className={currentIdx === 0 ? tone : ""}>{stages[0]?.label}</span>
        {currentIdx > 0 && currentIdx < stages.length - 1 ? <span className={tone}>{current?.label}</span> : null}
        <span className={currentIdx === stages.length - 1 ? tone : ""}>{stages.at(-1)?.label}</span>
      </span>
    </span>
  );
}
