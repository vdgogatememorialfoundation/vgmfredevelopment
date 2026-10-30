import type { Order, ShipmentEvent, ShipmentRecord } from "@/types";
import { storeConfig } from "@/lib/constants";

/** Deterministic 6-digit pickup OTP derived from the order id. */
export function pickupOtp(orderId: string): string {
  let hash = 0;
  for (const char of orderId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return String(100000 + (hash % 900000));
}

export type TrackingStageId =
  | "ordered"
  | "packed"
  | "shipped"
  | "out"
  | "delivered"
  | "ready"
  | "picked"
  | "cancelled"
  | "failed";

export interface TrackingStage {
  id: TrackingStageId;
  label: string;
  caption: string;
  events: ShipmentEvent[];
  reached: boolean;
  partial: boolean;
}

export type CourierScan = {
  at: string;
  status: string;
  location?: string;
  agent?: { name?: string; phone?: string };
  otp?: string;
};

export function isHyperlocalProvider(provider?: string) {
  return provider === "tookan" || provider === "shipday";
}

export function isSampleOrder(order: Pick<Order, "id" | "paymentLink" | "paymentRef" | "courierName">) {
  const id = String(order.id || "");
  if (/^(sample|demo|fake)/i.test(id) || /sample/i.test(id)) return true;
  const ref = `${order.paymentRef ?? ""} ${order.courierName ?? ""} ${order.paymentLink?.provider ?? ""}`.toLowerCase();
  if (ref.includes("sample order") || ref.includes("demo awb")) return true;
  return false;
}

export type CourierStage = "ordered" | "packed" | "shipped" | "out" | "delivered" | "failed" | "cancelled";

export function classifyCourierScan(text: string): CourierStage | null {
  const value = text.toLowerCase();
  if (!value.trim()) return null;
  if (/\b(rto|return to origin|undeliver|not delivered|delivery failed|failed delivery|consignee refused|lost|destroyed)\b/.test(value)) {
    return "failed";
  }
  if (/\bcancel/.test(value)) return "cancelled";
  if (/\b(out for delivery|ofd|out-for-delivery|agent out)\b/.test(value)) return "out";
  if (/\bdeliver/.test(value) && !/\b(attempt|failed|undeliver)\b/.test(value)) return "delivered";
  if (/\b(in transit|shipped|dispatch|left (the )?hub|arrived at|reached (destination|hub)|picked up|pickup done|manifested)\b/.test(value)) {
    return "shipped";
  }
  if (/\b(pack|booked|label generated|awb generated|ready to ship|handover)\b/.test(value)) return "packed";
  if (/\b(order placed|created|placed|confirmed)\b/.test(value)) return "ordered";
  return null;
}

const STAGE_RANK: Record<CourierStage, number> = {
  ordered: 0,
  packed: 1,
  shipped: 2,
  out: 3,
  delivered: 4,
  cancelled: 5,
  failed: 5,
};

function destLabel(order: Order) {
  const city = order.deliveryAddress?.city || "Pune";
  const state = order.deliveryAddress?.state || "Maharashtra";
  return `${city}, ${state}, India`;
}

function scanEvent(scan: CourierScan, index: number, reached: boolean): ShipmentEvent {
  return {
    id: `scan-${index}-${scan.at}`,
    title: scan.status,
    at: scan.at,
    location: scan.location,
    agent: scan.agent,
    otp: scan.otp,
    reached,
  };
}

function stageFromOrderStatus(status: Order["status"]): CourierStage {
  switch (status) {
    case "Failed":
      return "failed";
    case "Cancelled":
      return "cancelled";
    case "Delivered":
      return "delivered";
    case "Out for Delivery":
      return "out";
    case "Shipped":
      return "shipped";
    case "Packed":
    case "Ready to Ship":
    case "Accepted":
    case "Processing":
      return "packed";
    default:
      return "ordered";
  }
}

function highestScanStage(scans: CourierScan[]): { stage: CourierStage; at?: string } {
  let stage: CourierStage = "ordered";
  let at: string | undefined;
  for (const scan of scans) {
    const mapped = classifyCourierScan(scan.status);
    if (!mapped) continue;
    if (STAGE_RANK[mapped] >= STAGE_RANK[stage]) {
      stage = mapped;
      at = scan.at;
    }
  }
  return { stage, at };
}

function makeStage(
  id: TrackingStageId,
  label: string,
  caption: string,
  events: ShipmentEvent[],
  reached: boolean,
  partial = false
): TrackingStage {
  return { id, label, caption, events, reached, partial };
}

/**
 * One vertical pipeline from Ordered to Delivered or Failed.
 * Later stages only fill when a courier scan (or a real booking/pack event) says so.
 */
export function buildTrackingStages(
  order: Order,
  scans: CourierScan[] = [],
  shipment?: Pick<ShipmentRecord, "generatedAt" | "courier" | "awb" | "status" | "tracking" | "note"> | null
): {
  stages: TrackingStage[];
  reachedEvents: number;
  totalEvents: number;
} {
  const dest = destLabel(order);
  const origin = "Pune, Maharashtra, India";
  const courier = order.courierName ?? shipment?.courier ?? storeConfig.courierName;
  const trackingId = order.trackingId ?? shipment?.awb ?? "";
  const liveScans = scans.length ? scans : shipment?.tracking ?? [];
  const fromScans = highestScanStage(liveScans);
  const packedAt =
    order.history?.find((item) => /pack|book/i.test(`${item.status} ${item.note ?? ""}`))?.at ||
    shipment?.generatedAt ||
    "";

  if (order.status === "Cancelled" || fromScans.stage === "cancelled") {
    const stages = [
      makeStage(
        "ordered",
        "Ordered",
        "Order placed",
        [{ id: "placed", title: "Your order has been placed", at: order.date, location: origin, reached: true }],
        true
      ),
      makeStage(
        "cancelled",
        "Cancelled",
        "Order cancelled",
        [
          {
            id: "cancelled",
            title: "Your order was cancelled",
            at: fromScans.at || order.history?.find((item) => /cancel/i.test(item.status))?.at || order.date,
            location: origin,
            reached: true,
            detail: order.cancelReason || "Refund will be initiated to your original payment method within 3–5 business days.",
          },
        ],
        true
      ),
    ];
    return tally(stages);
  }

  if (order.deliveryMode === "store_pickup") {
    const packed = ["Packed", "Ready to Ship", "Shipped", "Out for Delivery", "Delivered"].includes(order.status);
    const ready = packed;
    const picked = order.status === "Delivered";
    const stages = [
      makeStage(
        "ordered",
        "Ordered",
        "Order placed",
        [{ id: "placed", title: "Your order has been placed", at: order.date, location: origin, reached: true }],
        true
      ),
      makeStage(
        "packed",
        "Packed",
        "Packing at store",
        packed
          ? [
              {
                id: "packed",
                title: "Your item is packed at our facility",
                at: packedAt || order.date,
                location: origin,
                reached: true,
              },
            ]
          : [],
        packed,
        false
      ),
      makeStage(
        "ready",
        "Ready for Pickup",
        "Ready at store",
        ready
          ? [
              {
                id: "ready",
                title: "Your item is ready for store pickup",
                at: packedAt || order.date,
                location: "Vaidya Gogate Memorial Foundation, Pune, Maharashtra, India",
                detail: `Pickup OTP: ${pickupOtp(order.id)} — share it with the front desk. Held for ${storeConfig.pickupHoldingDays} days. Carry a valid ID.`,
                reached: true,
              },
            ]
          : [],
        ready
      ),
      makeStage(
        "picked",
        "Picked Up",
        "Collected from store",
        picked
          ? [
              {
                id: "picked-up",
                title: "Item collected from store",
                at: fromScans.at || order.history?.find((item) => item.status === "Delivered")?.at || order.date,
                location: origin,
                detail: "Thank you for shopping with us.",
                reached: true,
              },
            ]
          : [],
        picked
      ),
    ];
    return tally(stages);
  }

  const booked = Boolean(shipment && shipment.note !== "Cancelled") || Boolean(trackingId) || ["Packed", "Ready to Ship", "Shipped", "Out for Delivery", "Delivered", "Failed"].includes(order.status);
  const scanStage = fromScans.stage;
  const orderStage = stageFromOrderStatus(order.status);
  let progress: CourierStage = "ordered";
  if (booked || orderStage === "packed") progress = "packed";
  for (const scan of liveScans) {
    const mapped = classifyCourierScan(scan.status);
    if (!mapped || mapped === "failed" || mapped === "cancelled") continue;
    if (STAGE_RANK[mapped] > STAGE_RANK[progress]) progress = mapped;
  }
  const failedReached = scanStage === "failed" || orderStage === "failed";
  const packedReached = STAGE_RANK[progress] >= STAGE_RANK.packed || failedReached;
  const shippedReached = STAGE_RANK[progress] >= STAGE_RANK.shipped;
  const outReached = STAGE_RANK[progress] >= STAGE_RANK.out;
  const deliveredReached = progress === "delivered" && !failedReached;

  const packedEvents: ShipmentEvent[] = [];
  if (packedReached) {
    packedEvents.push({
      id: "packed",
      title: "Your item has been packed at our facility",
      at: packedAt || order.date,
      location: origin,
      reached: true,
    });
  }

  const shippedEvents = liveScans
    .map((scan, index) => ({ scan, mapped: classifyCourierScan(scan.status), index }))
    .filter((item) => item.mapped === "shipped" || item.mapped === "packed")
    .filter((item) => item.mapped === "shipped")
    .map((item) => scanEvent(item.scan, item.index, shippedReached));

  if (shippedReached && shippedEvents.length === 0) {
    shippedEvents.push({
      id: "shipped",
      title: "Courier has the parcel",
      at: fromScans.at || packedAt || order.date,
      location: origin,
      detail: trackingId ? `Courier: ${courier} · Tracking id: ${trackingId}` : `Courier: ${courier}`,
      reached: true,
    });
  }

  const outEvents = liveScans
    .map((scan, index) => ({ scan, mapped: classifyCourierScan(scan.status), index }))
    .filter((item) => item.mapped === "out")
    .map((item) => scanEvent(item.scan, item.index, outReached));

  const deliveredEvents = liveScans
    .map((scan, index) => ({ scan, mapped: classifyCourierScan(scan.status), index }))
    .filter((item) => item.mapped === "delivered")
    .map((item) => scanEvent(item.scan, item.index, deliveredReached));

  const failedEvents = liveScans
    .map((scan, index) => ({ scan, mapped: classifyCourierScan(scan.status), index }))
    .filter((item) => item.mapped === "failed")
    .map((item) => scanEvent(item.scan, item.index, failedReached));

  if (failedReached && failedEvents.length === 0) {
    failedEvents.push({
      id: "failed",
      title: "Delivery failed",
      at: fromScans.at || order.date,
      location: dest,
      reached: true,
      detail: "The courier marked this shipment as failed or returned. Contact the Foundation if you need a reattempt.",
    });
  }

  const stages: TrackingStage[] = [
    makeStage(
      "ordered",
      "Ordered",
      "Order placed",
      [{ id: "placed", title: "Your order has been placed", at: order.date, location: origin, reached: true }],
      true
    ),
    makeStage("packed", "Packed", "Packed at our facility", packedEvents, packedReached),
    makeStage(
      "shipped",
      "Shipped",
      trackingId ? `${courier} · ${trackingId}` : "Handed to courier",
      shippedEvents,
      shippedReached,
      packedReached && !shippedReached && liveScans.some((scan) => classifyCourierScan(scan.status) == null)
    ),
    makeStage("out", "Out for Delivery", "Courier on the way", outEvents, outReached),
  ];

  if (failedReached) {
    stages.push(makeStage("failed", "Failed", "Delivery failed", failedEvents, true));
    return tally(stages.filter((stage) => stage.reached || stage.id === "failed"));
  }
  stages.push(makeStage("delivered", "Delivered", "Delivered", deliveredEvents, deliveredReached));

  return tally(stages);
}

function tally(stages: TrackingStage[]) {
  const totalEvents = Math.max(1, stages.length);
  const reachedEvents = stages.filter((stage) => stage.reached).length + (stages.some((stage) => stage.partial) ? 0.45 : 0);
  return { stages, reachedEvents, totalEvents };
}

export function shipmentScans(shipment?: Pick<ShipmentRecord, "tracking"> | null, extra: CourierScan[] = []): CourierScan[] {
  const seen = new Set<string>();
  const list: CourierScan[] = [];
  for (const scan of [...(shipment?.tracking ?? []), ...extra]) {
    const key = `${scan.at}|${scan.status}|${scan.location ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(scan);
  }
  return list.sort((a, b) => Date.parse(a.at || "") - Date.parse(b.at || "") || 0);
}
