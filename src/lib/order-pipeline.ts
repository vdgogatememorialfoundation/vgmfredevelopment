import type { Order, ShipmentEvent, ShipmentRecord } from "@/types";
import { customerCourierLabel } from "@/lib/courier-label";
import { siteConfig, storeConfig } from "@/lib/constants";
import { getOrderSettings, orderStatusText } from "@/lib/integrations";

/** Deterministic 6-digit pickup OTP derived from the order id. */
export function pickupOtp(orderId: string): string {
  let hash = 0;
  for (const char of orderId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return String(100000 + (hash % 900000));
}

const PICKUP_PROCESSED: Order["status"][] = ["Packed", "Ready to Ship", "Shipped", "Out for Delivery", "Delivered"];

/** The pickup OTP is usable only after the seller has packed (processed) a store-pickup order. */
export function pickupOtpReady(order: Pick<Order, "deliveryMode" | "status">) {
  return order.deliveryMode === "store_pickup" && PICKUP_PROCESSED.includes(order.status);
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
  | "cancel-review"
  | "refunded"
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

const REGULAR_COURIER = /blue\s*dart|dtdc|delhivery|ekart|fedex|india\s*post|speed\s*post|trackon|amazon|xpressbees|ecom\s*express|professional\s*couriers?|maruti|\bgati\b|\bdhl\b|aramex|\bups\b|smartr/i;

/** Rider map / live rider details only for local riders; never for a regular courier, whatever was booked earlier. */
export function isHyperlocalProvider(provider?: string, lastMile?: string, courier?: string) {
  if (REGULAR_COURIER.test(`${courier ?? ""} ${provider ?? ""}`)) return false;
  return Boolean(lastMile) || provider === "porter" || provider === "shadowfax" || provider === "flash" || provider === "tookan" || provider === "shipday";
}

export function isSampleOrder(order: Pick<Order, "id" | "paymentLink" | "paymentRef" | "courierName">) {
  const id = String(order.id || "");
  if (/^(sample|demo|fake)/i.test(id) || /sample/i.test(id)) return true;
  const ref = `${order.paymentRef ?? ""} ${order.courierName ?? ""} ${order.paymentLink?.provider ?? ""}`.toLowerCase();
  if (ref.includes("sample order") || ref.includes("demo awb")) return true;
  return false;
}

export type CourierStage = "ordered" | "packed" | "shipped" | "out" | "delivered" | "failed" | "cancelled";

/** Summary lines on courier pages ("Expected Date of Delivery", "Pickup Date") that are not scans. */
export function isCourierInfoLine(text: string) {
  const value = text.toLowerCase().replace(/[_-]+/g, " ");
  return /\b(expected|estimated|promised|tentative|scheduled)\b[\w ]{0,20}\bdeliver|\bedd\b|\b(pickup|booking|ship|shipment|delivery|dispatch) date\b|\bdate of (delivery|pickup|booking|dispatch)\b/.test(value);
}

const FAILED_ATTEMPT =
  /\b(undeliver(ed|able)?|not delivered|delivery failed|failed delivery|failed attempt|delivery attempt(ed)?|attempt(ed)? (failed|unsuccessful)|unsuccessful|(consignee|customer|receiver) (not available|unavailable|not reachable|not responding)|door locked|premises closed|address (incomplete|not found|issue)|re ?attempt|ndr|reschedul(e|ed))\b/;
const FINAL_FAILURE = /\b(rto|return to origin|returned to (origin|seller|shipper)|lost|destroyed|damaged)\b/;

/** A missed delivery the courier will try again (NDR), as opposed to a return to origin. */
export function isFailedAttempt(text: string) {
  const value = text.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return FAILED_ATTEMPT.test(value) && !FINAL_FAILURE.test(value);
}

export function classifyCourierScan(text: string): CourierStage | null {
  const value = text.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!value || isCourierInfoLine(value)) return null;
  // A failed attempt keeps the order out for delivery; only RTO / lost ends it as failed.
  if (FAILED_ATTEMPT.test(value) && !FINAL_FAILURE.test(value)) return "out";
  if (/\b(rto|return to origin|undeliver|not delivered|delivery failed|failed delivery|consignee refused|lost|destroyed|damaged|failed|declined|incomplete)\b/.test(value)) {
    return "failed";
  }
  if (/\bcancel/.test(value)) return "cancelled";
  if (/\b(successful|success|completed|complete|already delivered|task successful)\b/.test(value) && !/\b(attempt|fail|undeliver)\b/.test(value)) {
    return "delivered";
  }
  if (/pickup scheduled|pickup awaited|pickup pending|pickup generated|awaiting pickup|pickup request|out for pickup|ready for pickup|pickup assigned/.test(value)) {
    return "packed";
  }
  // Ekart and others route a new booking to the mother hub before the parcel is collected.
  if (/mother ?hub|shipment created|manifest(ed)? created|soft data|order (information|info) received/.test(value) && !/picked|collected|arrived|received at|reached/.test(value)) {
    return "packed";
  }
  if (
    /\b(in transit|shipment arrived|shipped|dispatch|departed|outscan|forwarded|further connected|connected|left (for |from )?(the )?(next )?(hub|facility|warehouse|location|origin|city)|shipment left|bagged|added to bag|en route to|reached (the )?(next )?(hub|facility)|arrived at|reached at|received at|inward|bag received|reached (the )?(destination|hub|facility|warehouse|pickup)|picked up|pickup done|pickup complete|manifested)\b/.test(
      value
    ) &&
    !/out for delivery|customer|doorstep/.test(value)
  ) {
    return "shipped";
  }
  if (/\bnot started\b/.test(value)) return "packed";
  if (/\b(out for delivery|ofd|agent out|started|in progress|on the way|en route|ready to deliver|reached drop|reached customer|arrived)\b/.test(value)) {
    return "out";
  }
  if (/\bdeliver/.test(value) && !/\b(attempt|failed|undeliver)\b/.test(value)) return "delivered";
  if (/\b(pack|booked|label generated|awb generated|ready to ship|handover|assigned|accepted|acknowledged|unassigned|not assigned|task created)\b/.test(value)) {
    return "packed";
  }
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

function cityName(value?: string) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text || /^-?\d+(\.\d+)?\s*,\s*-?\d+/.test(text)) return "";
  const parts = text.split(/[,|]/).map((part) => part.trim()).filter(Boolean);
  const place = parts.find((part) => /[a-z]/i.test(part) && !/^(india|hub|facility|warehouse|courier|center|centre)$/i.test(part));
  return (place ?? "").replace(/\b(hub|facility|warehouse|center|centre)\b/gi, "").trim();
}

/** Plain names for parcel scans from Tookan parcel, Shiprocket, and the other courier portals. */
/** Lines the desk wrote when a tracking id was attached; not a courier scan. */
export function isDeskScan(scan: { status: string; location?: string }) {
  return !scan.location && /^(handed to [^·]+|tracking id added\b.*)$/i.test(scan.status.trim());
}

export function courierEventTitle(status: string, location?: string) {
  const value = status.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const city = cityName(location) || cityName(status.split(/[-–]/).slice(1).join(" "));
  const place = city ? ` - ${city}` : "";
  if (/pickup scheduled|pickup awaited|pickup pending|pickup generated|awaiting pickup|pickup request|out for pickup|ready for pickup|pickup assigned/.test(value)) {
    return "Pickup scheduled";
  }
  if (/arrived at|reached at|received at|inward|bag received|reached (the )?(hub|facility|destination hub|warehouse)|at (the )?(hub|facility|warehouse)/.test(value) && !/out for delivery|customer|doorstep/.test(value)) {
    return `Shipment arrived at courier facility${place}`;
  }
  if (/left (for |from )?(the )?(next )?(hub|facility|warehouse|location|origin|city)|shipment left|bagged|added to bag|en route to|reached (the )?(next )?(hub|facility)|departed|\bdispatched\b|outscan|forwarded|in transit|shipment shipped|connected to/.test(value) && !/out for delivery/.test(value)) {
    return `Shipment left courier facility${place}`;
  }
  return status;
}

export const COURIER_DELIVERED_NOTE =
  "The courier has marked this order as delivered. If the parcel is not with you or anyone at your address, please contact the courier directly. Once we hand the parcel to the courier, we are not responsible for it.";

function scanEvent(scan: CourierScan, index: number, reached: boolean, title = scan.status): ShipmentEvent {
  return {
    id: `scan-${index}-${scan.at}`,
    title,
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
  shipment?: Pick<ShipmentRecord, "generatedAt" | "courier" | "awb" | "status" | "tracking" | "note" | "provider" | "pickupScheduledFor"> | null
): {
  stages: TrackingStage[];
  reachedEvents: number;
  totalEvents: number;
} {
  const dest = destLabel(order);
  const origin: string | undefined = undefined;
  const courier = customerCourierLabel({
    provider: shipment?.provider ?? order.courierChoice?.provider,
    courier: shipment?.courier || order.courierName,
  });
  const trackingId = order.trackingId ?? shipment?.awb ?? "";
  const liveScans = (scans.length ? scans : shipment?.tracking ?? []).filter((scan) => !isDeskScan(scan));
  const fromScans = highestScanStage(liveScans);
  const packedAt =
    order.history?.find((item) => /pack|book/i.test(`${item.status} ${item.note ?? ""}`))?.at ||
    shipment?.generatedAt ||
    "";

  if (order.status === "Cancelled" || fromScans.stage === "cancelled") {
    const cancelledAt =
      fromScans.at ||
      order.history?.find((item) => /cancel/i.test(`${item.status} ${item.note ?? ""}`))?.at ||
      order.date;
    const refunded = (order.refundAmount ?? 0) > 0 || order.paymentStatus === "Refunded" || order.paymentStatus === "Partially Refunded";
    const refundAt = order.history?.find((item) => /refund/i.test(`${item.status} ${item.note ?? ""}`))?.at || (refunded ? cancelledAt : "");
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
            title: "This order was cancelled",
            at: cancelledAt,
            location: origin,
            reached: true,
            // Desk notes such as "nil" or "-" are not meant for the customer.
            detail: order.cancelReason && !/^(nil|null|none|na|n\/a|-+|\.+)$/i.test(order.cancelReason.trim()) ? order.cancelReason : "",
          },
        ],
        true
      ),
    ];
    if (order.paymentStatus === "Paid" || refunded || (order.refundAmount ?? 0) > 0) {
      stages.push(
        makeStage(
          "refunded",
          refunded ? "Refund initiated" : "Refund pending",
          refunded ? "Refund to the original payment method" : "Refund will be issued by the desk",
          [
            {
              id: "cancel-refund",
              title: refunded
                ? `Refund of ₹${(order.refundAmount ?? 0).toLocaleString("en-IN")} initiated`
                : "Refund will be initiated to your original payment method within 3–5 business days.",
              at: refundAt || cancelledAt,
              reached: refunded,
              detail: refunded ? "" : "We will start the refund shortly.",
            },
          ],
          refunded,
          !refunded
        )
      );
    }
    return tally(stages, order);
  }

  if (order.deliveryMode === "store_pickup") {
    const picked = order.status === "Delivered";
    const ready = picked || PICKUP_PROCESSED.includes(order.status);
    const stages = [
      makeStage(
        "ordered",
        "Order Confirmed",
        "Order placed",
        [{ id: "placed", title: "Your order has been placed", at: order.date, location: origin, reached: true }],
        true
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
                location: siteConfig.address,
                detail:
                  order.status === "Delivered"
                    ? "OTP verified · collected from the store."
                    : `Pickup OTP: ${pickupOtp(order.id)} — share it with the front desk. Held for ${storeConfig.pickupHoldingDays} days. Carry a valid ID.`,
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
    return tally(holdBeforeNext(stages), order);
  }

  const shipmentBooked = Boolean(shipment && shipment.note !== "Cancelled" && (shipment.awb || shipment.status));
  const booked =
    shipmentBooked ||
    ["Packed", "Ready to Ship", "Shipped", "Out for Delivery", "Delivered", "Failed"].includes(order.status);
  const scanStage = fromScans.stage;
  const orderStage = stageFromOrderStatus(order.status);
  let progress: CourierStage = "ordered";
  if (booked || orderStage === "packed") progress = "packed";
  for (const scan of liveScans) {
    const mapped = classifyCourierScan(scan.status);
    if (!mapped || mapped === "failed" || mapped === "cancelled") continue;
    if (STAGE_RANK[mapped] > STAGE_RANK[progress]) progress = mapped;
  }
  const failedReached = (scanStage === "failed" || orderStage === "failed") && scanStage !== "delivered" && scanStage !== "out" && order.status !== "Delivered";
  const packedReached = STAGE_RANK[progress] >= STAGE_RANK.packed || failedReached;
  const collected = liveScans.some((scan) =>
    /\b(picked up|pickup done|pickup complete|collected|handed to|handover|dispatched)\b/i.test(scan.status) && classifyCourierScan(scan.status) !== "packed"
  );
  const shipmentLeft = Boolean(
    shipment && ["Picked Up", "In Transit", "Out for Delivery", "Delivered"].includes(shipment.status ?? "")
  );
  const hyperlocal = isHyperlocalProvider(shipment?.provider ?? order.courierChoice?.provider, order.courierChoice?.lastMile, shipment?.courier || order.courierName);
  let shippedReached =
    collected ||
    shipmentLeft ||
    ["Shipped", "Out for Delivery", "Delivered"].includes(order.status) ||
    STAGE_RANK[progress] >= STAGE_RANK.shipped;
  const outReached = STAGE_RANK[progress] >= STAGE_RANK.out || (hyperlocal && shippedReached);
  if (hyperlocal) shippedReached = false;
  const courierDelivered = order.status === "Delivered" || shipment?.status === "Delivered";
  const deliveredReached = (progress === "delivered" || courierDelivered) && !failedReached;

  const packedEvents: ShipmentEvent[] = [];
  if (packedReached) {
    packedEvents.push({
      id: "packed",
      title: "Packed and ready for handover",
      at: packedAt || order.date,
      location: origin,
      reached: true,
    });
  }
  if (!hyperlocal) {
    liveScans.forEach((scan, index) => {
      if (!/pickup scheduled|pickup awaited|pickup pending|awaiting pickup|pickup request|out for pickup|ready for pickup/i.test(scan.status)) return;
      packedEvents.push(scanEvent(scan, index, true, "Pickup scheduled"));
    });
  }
  if (!hyperlocal && shipment?.pickupScheduledFor && !packedEvents.some((event) => event.title === "Pickup scheduled")) {
    packedEvents.push({
      id: "pickup-scheduled",
      title: "Pickup scheduled",
      at: shipment.pickupScheduledFor,
      location: origin,
      reached: true,
    });
  }

  const shippedEvents = liveScans
    .map((scan, index) => ({ scan, mapped: classifyCourierScan(scan.status), index }))
    .filter((item) => item.mapped === "shipped")
    .map((item) =>
      scanEvent(
        item.scan,
        item.index,
        shippedReached,
        hyperlocal ? item.scan.status : courierEventTitle(item.scan.status, item.scan.location)
      )
    );

  if (shippedReached && shippedEvents.length === 0) {
    shippedEvents.push({
      id: "shipped",
      title: "Collected by the courier",
      at: fromScans.at || packedAt || order.date,
      location: origin,
      detail: shippedReached && trackingId ? `Courier: ${courier} · Tracking id: ${trackingId}` : `Courier: ${courier}`,
      reached: true,
    });
  }

  const outEvents = liveScans
    .map((scan, index) => ({ scan, mapped: classifyCourierScan(scan.status), index }))
    .filter((item) => item.mapped === "out" || (hyperlocal && item.mapped === "shipped"))
    .map((item) =>
      isFailedAttempt(item.scan.status)
        ? {
            ...scanEvent(item.scan, item.index, outReached, "Delivery attempt unsuccessful"),
            detail: `${cleanScanText(item.scan.status)} · the courier will reattempt delivery.`,
          }
        : scanEvent(item.scan, item.index, outReached)
    );

  if (hyperlocal && outReached && outEvents.length === 0) {
    outEvents.push({
      id: "out",
      title: "Collected from the store",
      at: fromScans.at || packedAt || order.date,
      location: origin,
      reached: true,
    });
  }

  const deliveredEvents = liveScans
    .map((scan, index) => ({ scan, mapped: classifyCourierScan(scan.status), index }))
    .filter((item) => item.mapped === "delivered")
    .map((item) => scanEvent(item.scan, item.index, deliveredReached));

  if (deliveredReached && deliveredEvents.length === 0) {
    const markedAt = order.history?.find((item) => item.status === "Delivered")?.at || fromScans.at || order.date;
    deliveredEvents.push({
      id: "delivered-confirm",
      title: "Delivered",
      at: markedAt,
      location: dest,
      reached: true,
    });
  }

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
      "Order confirmed",
      [{ id: "placed", title: "Order confirmed", at: order.date, location: origin, reached: true }],
      true
    ),
    makeStage("packed", "Packed", "Packed for dispatch", packedEvents, packedReached),
  ];
  if (!hyperlocal) {
    stages.push(
      makeStage("shipped", "Shipped", "Handed over to the courier", shippedEvents, shippedReached)
    );
  }
  stages.push(makeStage("out", "Out for delivery", "", outEvents, outReached));

  if (failedReached) {
    stages.push(makeStage("failed", "Failed", "Delivery failed", failedEvents, true));
    return tally(stages.filter((stage) => stage.reached || stage.id === "failed"), order);
  }
  const lastDelivered = deliveredEvents.at(-1);
  if (deliveredReached && lastDelivered && !hyperlocal) lastDelivered.notice = COURIER_DELIVERED_NOTE;
  stages.push(makeStage("delivered", "Delivered", "Delivered to the address", deliveredEvents, deliveredReached));

  return tally(holdBeforeNext(stages), order);
}

/** The current step stays open so the line moves toward the next one and stops before it. */
function holdBeforeNext(stages: TrackingStage[]) {
  const terminal = new Set(["delivered", "picked", "failed", "cancelled", "refunded"]);
  // Once a final step (Delivered, Picked Up…) is reached nothing is in progress, so the line stops there.
  if (stages.some((stage) => stage.reached && terminal.has(stage.id))) return stages;
  let index = -1;
  stages.forEach((stage, position) => {
    if (stage.reached && !terminal.has(stage.id)) index = position;
  });
  const next = index >= 0 ? stages[index + 1] : undefined;
  if (index < 0 || !next || next.reached || terminal.has(next.id)) return stages;
  const copy = stages.slice();
  copy[index] = { ...copy[index], partial: true };
  return copy;
}

function tally(stages: TrackingStage[], order?: Order) {
  const { statusLabels } = getOrderSettings();
  (order?.history ?? []).forEach((item, index) => {
    if (!item.custom) return;
    const stage = stages.find((row) => row.id === item.custom) ?? [...stages].reverse().find((row) => row.reached);
    stage?.events.push({ id: `custom-${index}`, title: item.status, at: item.at, reached: true, detail: item.note });
    stage?.events.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  });
  for (const stage of stages) stage.label = orderStatusText(stage.label, statusLabels);
  const totalEvents = Math.max(1, stages.length);
  const reachedEvents = stages.filter((stage) => stage.reached).length + (stages.some((stage) => stage.partial) ? 0.45 : 0);
  return { stages, reachedEvents, totalEvents };
}

const RAW_STAMP = /\s*[-–,]?\s*(?:\d{4}-)?\d{1,2}[- ]\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*$/;

export function cleanScanText(text: string) {
  return text.replace(RAW_STAMP, "").trim();
}

export function usableScan(scan: { at?: string; status?: string }) {
  const ms = Date.parse(scan.at || "");
  return Number.isFinite(ms) && new Date(ms).getUTCFullYear() >= 2000 && Boolean(cleanScanText(scan.status || ""));
}

export function shipmentScans(shipment?: Pick<ShipmentRecord, "tracking"> | null, extra: CourierScan[] = []): CourierScan[] {
  const seen = new Set<string>();
  const list: CourierScan[] = [];
  for (const raw of [...(shipment?.tracking ?? []), ...extra]) {
    if (!usableScan(raw)) continue;
    const scan = { ...raw, status: cleanScanText(raw.status) };
    const key = `${scan.at}|${scan.status}|${scan.location ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(scan);
  }
  return list.sort((a, b) => Date.parse(a.at || "") - Date.parse(b.at || "") || 0);
}
