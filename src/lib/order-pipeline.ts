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
  return Boolean(lastMile) || provider === "porter" || provider === "flash" || provider === "tookan" || provider === "shipday";
}

export function isSampleOrder(order: Pick<Order, "id" | "paymentLink" | "paymentRef" | "courierName">) {
  const id = String(order.id || "");
  if (/^(sample|demo|fake)/i.test(id) || /sample/i.test(id)) return true;
  const ref = `${order.paymentRef ?? ""} ${order.courierName ?? ""} ${order.paymentLink?.provider ?? ""}`.toLowerCase();
  if (ref.includes("sample order") || ref.includes("demo awb")) return true;
  return false;
}

const PICKUP_TITLE = "Your item has been picked up by delivery partner.";

export type CourierStage = "ordered" | "packed" | "shipped" | "out" | "delivered" | "failed" | "cancelled";

/** Summary lines on courier pages ("Expected Date of Delivery", "Pickup Date") that are not scans. */
export function isCourierInfoLine(text: string) {
  const value = text.toLowerCase().replace(/[_-]+/g, " ");
  return /\b(expected|estimated|promised|tentative|scheduled)\b[\w ]{0,20}\bdeliver|\bedd\b|\b(pickup|booking|ship|shipment|delivery|dispatch) date\b|\bdate of (delivery|pickup|booking|dispatch)\b/.test(value);
}

const FAILED_ATTEMPT =
  /\b(undeliver(ed|able)?|not delivered|delivery failed|failed delivery|failed attempt|delivery attempt(ed)?|attempt(ed)? (failed|unsuccessful)|unsuccessful|(consignee|customer|receiver) (not available|unavailable|not reachable|not responding|not contactable)|not contactable|unreachable|not accessible|will collect|self collect|door locked|premises closed|address (incomplete|not found|issue)|re ?attempt|ndr|not attempted|customer initiated delay|\bcid\b|reschedul(e|ed))\b/;
const FINAL_FAILURE = /\b(rto|rts|dto|return to (origin|seller|shipper)|returned|lost|destroyed|damaged)\b/;

/** A missed delivery the courier will try again (NDR), as opposed to a return to origin. */
export function isFailedAttempt(text: string) {
  const value = text.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return FAILED_ATTEMPT.test(value) && !FINAL_FAILURE.test(value);
}

/** Courier pickup scans, worded differently by each courier (Ekart "Pickup from seller", Delhivery "Picked up", …). */
const PICKED_UP =
  /\b(picked up|pickup done|pickup complete(d)?|pickup successful|pick ?up from (the )?(seller|shipper|merchant|vendor|warehouse|customer)|picked (from|by)|shipment picked|collected from (the )?(seller|shipper|merchant|vendor)|received at (the )?(mother ?hub|origin)|in ?scan(ned)? (at|to|in)|inscan|shipment received|received by (the )?carrier|^picked)\b/;
const PICKUP_PENDING = /scheduled|awaited|pending|request|out for pickup|assigned|generated|failed|cancel|reattempt|not picked/;

/** Courier is yet to collect the parcel (Blue Dart "out to P/U", Shadowfax "ofp", Xpressbees "Pending Pickup", …). */
const AWAITING_PICKUP =
  /pickup scheduled|pickup awaited|pickup pending|pending pickup|pickup generated|awaiting pickup|pickup request|out for pickup|out to p\/?u\b|^ofp$|ready for pickup|pickup assigned|assigned for (seller )?pickup/;

/** A real pickup scan from the courier (not "pickup scheduled"). */
export function isPickupScan(text: string) {
  const value = text.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return PICKED_UP.test(value) && !PICKUP_PENDING.test(value) && !/received at/.test(value);
}

/** Ekart routes a parcel ("Dispatched to MotherHub_PUNE") the moment it is booked; that alone is not a pickup. */
export function onlyRoutingScans(statuses: string[]) {
  const shipped = statuses.filter((status) => classifyCourierScan(status) === "shipped");
  return shipped.length > 0 && !statuses.some(isPickupScan) && shipped.every((status) => /\bdispatched to\b/i.test(status));
}

export function classifyCourierScan(text: string): CourierStage | null {
  const value = text.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!value || isCourierInfoLine(value)) return null;
  // Pickup problems ("Pickup Failed", "Pickup Rescheduled") mean the parcel is still with us, not failed or out for delivery.
  if (/\b(pick ?up|not picked)\b/.test(value) && /\b(queued|reschedul\w*|exception|error|fail\w*|cancel\w*|not picked|attempt\w*|delayed|on hold)\b/.test(value) && !/\brto\b/.test(value)) {
    return "packed";
  }
  // A failed attempt keeps the order out for delivery; only RTO / lost ends it as failed.
  if (FAILED_ATTEMPT.test(value) && !FINAL_FAILURE.test(value)) return "out";
  if (/\b(rto|rts|dto|return to (origin|seller|shipper)|returned|reached back at (the )?(seller|origin)|undeliver|not delivered|delivery failed|failed delivery|consignee refused|lost|destroyed|damaged|failed|declined|incomplete)\b/.test(value)) {
    return "failed";
  }
  if (/\bcancel/.test(value)) return "cancelled";
  // Bare "Successful"/"Completed" is how hyperlocal apps (Tookan etc.) report delivery; any other "... complete" scan (pickup, manifest, bagging) is not.
  if (/^(task |job |order |delivery |drop )?(successful|success|completed|complete)$|\balready delivered\b/.test(value)) {
    return "delivered";
  }
  if (AWAITING_PICKUP.test(value)) {
    return "packed";
  }
  if (PICKED_UP.test(value) && !PICKUP_PENDING.test(value)) return "shipped";
  // Ekart and others route a new booking to the mother hub before the parcel is collected.
  if (/mother ?hub|shipment created|manifest(ed)? (created|completed|generated)|^manifested$|manifest generated|soft ?data|shipment uploaded|order (information|info) received/.test(value) && !/picked|collected|arrived|received at|reached/.test(value)) {
    return "packed";
  }
  if (
    /\b(in transit|shipment arrived|trip arrived|vehicle arrived|bag arrived|shipped|dispatch(ed)?|despatch(ed)?|departed|outscan(ned)?|in ?scan(ned)?|item received|has left|added to connection|forwarded|further connected|connected|left (for |from )?(the )?(next )?(hub|facility|warehouse|location|origin|city)|shipment left|bagged|added to bag|en route to|reached (the )?(next )?(hub|facility)|arrived at|reached at|received at|inward|bag received|reached (the )?(destination|hub|facility|warehouse|pickup)|picked up|pickup done|pickup complete|handed (over )?to|misrouted|redirected|held at|on hold( at)?|recd at|bag added|bagging|left (the )?courier facility|assigned for delivery)\b/.test(
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
  if (/\bdelivered\b|\bdelivery (successful|success|completed?|done)\b/.test(value) && !/\b(attempt|failed|undeliver)\b/.test(value)) return "delivered";
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

/** Customers see an order the desk has not accepted yet (e.g. a pre-order) simply as Ordered. */
export function customerOrderStatus<T extends string>(status: T): T {
  return (status === "Awaiting Confirmation" ? "Ordered" : status) as T;
}

export function courierStageRank(stage: CourierStage) {
  return STAGE_RANK[stage];
}

/** Classifies scans in time order; once the courier has collected the parcel, later hub routing scans count as in transit. */
export function classifyScanSequence(statuses: string[]): (CourierStage | null)[] {
  let collected = false;
  return statuses.map((status) => {
    let mapped = classifyCourierScan(status);
    if (mapped === "packed" && collected && /dispatch|hub|manifest|bag|forward/i.test(status)) mapped = "shipped";
    if (mapped && mapped !== "failed" && mapped !== "cancelled" && STAGE_RANK[mapped] >= STAGE_RANK.shipped) collected = true;
    return mapped;
  });
}

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

export function courierEventTitle(status: string, location?: string, courier = "") {
  // Delhivery (via Shiprocket) spells it "Recieved at Origin Center".
  const value = status.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").replace(/\brecie?ved\b/g, "received").trim();
  const city = cityName(location) || cityName(status.split(/[-–]/).slice(1).join(" "));
  const place = city ? ` - ${city}` : "";
  const rule = (getOrderSettings().scanTitles ?? []).find(
    (row) =>
      row.match.trim() &&
      row.title.trim() &&
      value.includes(row.match.toLowerCase().replace(/[_-]+/g, " ").trim()) &&
      (!row.courier.trim() || courier.toLowerCase().includes(row.courier.trim().toLowerCase()))
  );
  if (rule) return rule.title.replace(/\s*[-–]?\s*\{city\}/i, place).trim();
  if (AWAITING_PICKUP.test(value)) {
    return "Pickup scheduled";
  }
  if (PICKED_UP.test(value) && !PICKUP_PENDING.test(value) && !/received at|in ?scan/.test(value)) return PICKUP_TITLE;
  if (classifyCourierScan(status) === "packed" && !/\bdispatch/.test(value)) return status;
  if (/arrived at|reached at|received at|inward|bag received|in ?scan|item received|trip arrived|vehicle arrived|origin cent(er|re)|^shipment arrived$|reached (the )?(hub|facility|destination hub|warehouse)|at (the )?(hub|facility|warehouse)/.test(value) && !/out for delivery|customer|doorstep/.test(value)) {
    return `Shipment arrived at courier facility${place}`;
  }
  if (/left (for |from )?(the )?(next )?(hub|facility|warehouse|location|origin|city)|shipment left|bagged|added to bag|en route to|reached (the )?(next )?(hub|facility)|departed|\bdispatched\b|\bdespatched\b|outscan|forwarded|in transit|shipment shipped|connected to|further connected|has left|added to connection/.test(value) && !/out for delivery/.test(value)) {
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
  // When no courier scan has reached a stage yet, its time is when the order was moved to that status, never an earlier booking scan.
  const stageAt = (stage: CourierStage, status: Order["status"]) =>
    (STAGE_RANK[fromScans.stage] >= STAGE_RANK[stage] ? fromScans.at : undefined) ||
    [...(order.history ?? [])].reverse().find((item) => item.status === status)?.at;
  // The day it was actually packed: the last "Packed" step, else the courier booking (not notes that mention packing).
  const packedAt =
    [...(order.history ?? [])].reverse().find((item) => /^packed$/i.test(item.status.trim()))?.at ||
    order.pick?.packedAt ||
    order.history?.find((item) => /^courier booked/i.test(item.status))?.at ||
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
          refunded
            ? order.refunds?.at(-1)?.destination === "store_credit"
              ? `Added to store credit${order.refunds.at(-1)?.reference ? ` · Transaction ID ${order.refunds.at(-1)?.reference}` : ""}`
              : `Refund to the original payment method${order.refunds?.at(-1)?.gatewayRefundId ? ` · Refund ID ${order.refunds.at(-1)?.gatewayRefundId}` : ""}`
            : "Refund will be issued by the desk",
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
    (/\b(picked up|pickup done|pickup complete|collected|handed to|handover|dispatched)\b/i.test(scan.status) && classifyCourierScan(scan.status) !== "packed") ||
    ["shipped", "out", "delivered"].includes(classifyCourierScan(scan.status) ?? "")
  );
  const shipmentLeft = Boolean(
    shipment && ["Picked Up", "In Transit", "Out for Delivery", "Delivered"].includes(shipment.status ?? "")
  );
  const hyperlocal = isHyperlocalProvider(shipment?.provider ?? order.courierChoice?.provider, order.courierChoice?.lastMile, shipment?.courier || order.courierName);
  const routingOnly = onlyRoutingScans(liveScans.map((scan) => scan.status)) && !["Shipped", "Out for Delivery", "Delivered"].includes(order.status);
  let shippedReached =
    (collected && !routingOnly) ||
    shipmentLeft ||
    ["Shipped", "Out for Delivery", "Delivered"].includes(order.status) ||
    (STAGE_RANK[progress] >= STAGE_RANK.shipped && !routingOnly);
  const outReached = STAGE_RANK[progress] >= STAGE_RANK.out || (hyperlocal && shippedReached);
  if (hyperlocal) shippedReached = false;
  const courierDelivered = order.status === "Delivered" || shipment?.status === "Delivered";
  const deliveredReached = (progress === "delivered" || courierDelivered) && !failedReached;

  const packedEvents: ShipmentEvent[] = [];
  if (packedReached) {
    packedEvents.push({
      id: "packed",
      title: "We have processed your order.",
      at: packedAt || order.date,
      location: origin,
      reached: true,
    });
    if (shipmentBooked && !hyperlocal && !shippedReached) {
      packedEvents.push({
        id: "awaiting-pickup",
        title: "Item waiting to be Picked up by Courier Partner",
        at: shipment?.generatedAt || packedAt || order.date,
        location: origin,
        reached: true,
      });
    }
  }
  if (!hyperlocal) {
    const scheduled = liveScans.findIndex((scan) => /pickup scheduled|pickup awaited|pickup pending|awaiting pickup|pickup request|out for pickup|ready for pickup/i.test(scan.status));
    if (scheduled >= 0) packedEvents.push(scanEvent(liveScans[scheduled], scheduled, true, "Pickup scheduled"));
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

  const scanStages = classifyScanSequence(liveScans.map((scan) => scan.status)).map((mapped, index, all) => {
    // A scan no rule recognises (delays, misroutes, holds…) still shows, under the stage the parcel is already in.
    if (mapped || isDeskScan(liveScans[index]) || isCourierInfoLine(liveScans[index].status)) return mapped;
    const before = all.slice(0, index).reverse().find((stage) => stage && stage !== "failed" && stage !== "cancelled");
    return before === "shipped" || before === "out" ? before : null;
  });
  // Ekart logs "Dispatched to <next hub>" at the next hub's city; the parcel left the facility it last reached.
  const leftFrom = (index: number) => {
    const scan = liveScans[index];
    if (!/\bdispatched to\b/i.test(scan.status)) return scan;
    const before = liveScans.slice(0, index).reverse().find((item) => item.location && !/\bdispatched to\b/i.test(item.status));
    return before?.location ? { ...scan, location: before.location } : scan;
  };
  const shippedEvents = liveScans
    .map((scan, index) => ({ scan, mapped: scanStages[index], index }))
    .filter((item) => item.mapped === "shipped" && !routingOnly)
    .map((item) => {
      const scan = hyperlocal ? item.scan : leftFrom(item.index);
      return scanEvent(scan, item.index, shippedReached, hyperlocal ? scan.status : courierEventTitle(scan.status, scan.location, courier));
    })
    // Customers see only: picked up, arrived at / left a courier facility (every courier's raw scans stay in Admin).
    .filter((event) => hyperlocal || event.title === PICKUP_TITLE || /^Shipment (arrived at|left) courier facility/.test(event.title))
    // Couriers often log one pickup as several scans ("Pickup From Seller", "Picked Up"); show it once.
    .filter((event, index, list) => event.title !== PICKUP_TITLE || list.findIndex((other) => other.title === PICKUP_TITLE) === index)
    .filter((event, index, list) => hyperlocal || index === 0 || list[index - 1].title !== event.title);

  if (shippedReached && shippedEvents.length === 0) {
    shippedEvents.push({
      id: "shipped",
      title: PICKUP_TITLE,
      at: stageAt("shipped", "Shipped") || fromScans.at || packedAt || order.date,
      location: origin,
      detail: shippedReached && trackingId ? `Courier: ${courier} · Tracking id: ${trackingId}` : `Courier: ${courier}`,
      reached: true,
    });
  }

  // Hyperlocal customers see only: Picked up from seller, Out for delivery (then Delivered). Rider app steps and GPS stay in Admin.
  const pickedIdx = hyperlocal ? liveScans.findIndex((scan) => /picked up/i.test(scan.status)) : -1;
  const outEvents = liveScans
    .map((scan, index) => ({ scan, mapped: scanStages[index], index }))
    .filter((item) => item.mapped === "out" || (hyperlocal && item.mapped === "shipped"))
    .filter((item) => !hyperlocal || (pickedIdx >= 0 && item.index >= pickedIdx))
    .map((item) => {
      if (isFailedAttempt(item.scan.status)) {
        return {
          ...scanEvent(item.scan, item.index, outReached, "Delivery attempt unsuccessful"),
          detail: `${cleanScanText(item.scan.status)} · the courier will reattempt delivery.`,
        };
      }
      if (!hyperlocal) return scanEvent(item.scan, item.index, outReached, "Out for delivery");
      const title = /picked up/i.test(item.scan.status) ? "Picked up from seller" : "Out for delivery";
      return { ...scanEvent({ ...item.scan, location: "" }, item.index, outReached, title), detail: undefined };
    })
    .filter((event, index, list) =>
      hyperlocal ? list.findIndex((other) => other.title === event.title) === index : index === 0 || list[index - 1].title !== event.title
    );

  if (hyperlocal && outReached && outEvents.length === 0) {
    outEvents.push({
      id: "out",
      title: "Collected from the store",
      at: stageAt("out", "Out for Delivery") || fromScans.at || packedAt || order.date,
      location: origin,
      reached: true,
    });
  }

  const deliveredEvents = liveScans
    .map((scan, index) => ({ scan, mapped: classifyCourierScan(scan.status), index }))
    .filter((item) => item.mapped === "delivered")
    .slice(0, 1)
    .map((item) => scanEvent(item.scan, item.index, deliveredReached, "Delivered"));

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
      at: stageAt("failed", "Failed") || fromScans.at || order.date,
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
