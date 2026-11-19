import { customerCourierLabel } from "@/lib/courier-label";
import { classifyCourierScan, classifyScanSequence, cleanScanText, courierStageRank, isCourierInfoLine, isHyperlocalProvider, onlyRoutingScans, usableScan } from "@/lib/order-pipeline";
import {
  ithinkTrack,
  nimbusTrack,
  shipdayTrack,
  shiprocketTrack,
  shipyaariTrack,
  goswiftTrack,
  ekartTrack,
  shadowfaxTrack,
  enviaTrack,
  daaklyTrack,
  rapidshypTrack,
  vamashipTrack,
  tookanTrack,
} from "@/lib/server/providers";
import { courierWebTrack, type TrackerCreds } from "@/lib/server/courier-web-track";
import { issueDeliveryInvoice } from "@/lib/server/delivery-invoice";
import { findShopOrder, patchShopOrder } from "@/lib/server/shop-orders";
import { findShopShipment, listShopShipments, replaceShopShipment } from "@/lib/server/shop-shipments";
import { readShippingCreds } from "@/lib/server/shipping-vault";
import type { Order, ShipmentRecord } from "@/types";
import { inviteOrderFeedback } from "@/lib/server/forms";
import { withScanPlaces } from "@/lib/server/place-lookup";

/** Same scan when the text and town match, whatever the case ("PUNE" and "Pune, Maharashtra, India"). */
const placeKey = (location?: string) => (location ?? "").split(",")[0].trim().toLowerCase();

type TrackHit = {
  status?: string;
  events?: { at: string; status: string; location?: string }[];
  trackingUrl?: string;
  courierName?: string;
  awb?: string;
  lat?: number;
  lng?: number;
  agentName?: string;
  agentPhone?: string;
  otp?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  accepted?: boolean;
  agentLeg?: "pickup" | "delivery";
  expectedBy?: string;
};

type Scan = { at: string; status: string; location?: string; src?: "site" | "api" };

function dedupe(events: Scan[]) {
  const out: Scan[] = [];
  for (const raw of events) {
    if (!usableScan(raw)) continue;
    const event = { ...raw, status: cleanScanText(raw.status) };
    const prev = out[out.length - 1];
    if (prev && prev.status.toLowerCase() === event.status.toLowerCase() && placeKey(prev.location) === placeKey(event.location)) continue;
    out.push(event);
  }
  return out;
}

async function track(
  provider: string,
  awb: string,
  providerOrderId: string | undefined,
  extraId: string | undefined,
  creds: Record<string, Record<string, unknown>>,
  shopOrderId = ""
) {
  const own = creds[provider] ?? creds[provider.replace("-parcel", "")] ?? {};
  if (provider === "shiprocket") return shiprocketTrack(own, awb);
  if (provider === "nimbuspost") return nimbusTrack(own, awb);
  if (provider === "ithink") return ithinkTrack(creds.ithink ?? own, awb);
  if (provider === "shipyaari") return shipyaariTrack(creds.shipyaari ?? own, awb);
  if (provider === "goswift") return goswiftTrack(creds.goswift ?? own, awb);
  if (provider === "ekart") return ekartTrack(creds.ekart ?? own, awb);
  if (provider === "envia") return enviaTrack(creds.envia ?? own, awb);
  if (provider === "daakly") return daaklyTrack(creds.daakly ?? own, awb);
  if (provider === "rapidshyp") return rapidshypTrack(creds.rapidshyp ?? own, awb);
  if (provider === "vamaship") return vamashipTrack(creds.vamaship ?? own, awb);
  if (provider === "shadowfax") return shadowfaxTrack(creds.shadowfax ?? own, awb, String(extraId ?? "") === "reverse");
  if (provider === "tookan" || provider === "tookan-parcel") {
    return tookanTrack(creds.tookan ?? own, String(providerOrderId || awb), String(extraId || awb));
  }
  if (provider === "shipday") return shipdayTrack(own, shopOrderId, String(providerOrderId ?? awb));
  return null;
}

function shipmentStatusFor(stage: string): ShipmentRecord["status"] | undefined {
  if (stage === "failed") return "Failed";
  if (stage === "delivered") return "Delivered";
  if (stage === "out") return "Out for Delivery";
  if (stage === "shipped") return "In Transit";
  if (stage === "packed") return "Booked";
  return undefined;
}

function orderStatusFor(stage: string, hyperlocal: boolean): Order["status"] | undefined {
  if (stage === "failed") return "Failed";
  if (stage === "delivered") return "Delivered";
  if (stage === "out" || (hyperlocal && stage === "shipped")) return "Out for Delivery";
  if (stage === "shipped") return "Shipped";
  if (stage === "packed") return "To Ship";
  return undefined;
}

export async function refreshStoredShipment(orderId: string, shipmentId = "") {
  const shipment = findShopShipment(orderId, shipmentId);
  if (!shipment) return { ok: false as const, error: "Shipment not on the server yet." };
  const provider = shipment.provider;
  const direct = !shipment.live && shipment.directCourier ? shipment.directCourier : "";
  if (!direct && (!shipment.live || !provider || provider === "local")) {
    return { ok: true as const, live: false as const, shipment };
  }
  const creds = readShippingCreds() as Record<string, Record<string, unknown>>;
  let hit: TrackHit | null = null;
  try {
    hit = direct
      ? await courierWebTrack(direct, shipment.awb, (creds.tracker ?? {}) as TrackerCreds)
      : ((await track(provider!, shipment.awb, shipment.providerOrderId, shipment.providerShipmentId, creds, orderId)) as TrackHit | null);
  } catch {
    return { ok: true as const, live: false as const, shipment };
  }
  if (!hit) return { ok: true as const, live: false as const, shipment };
  // Ekart is read from one source only: ekartlogistics.com (clean wording, hub scans first); the Ekart Elite API only when the site gives nothing.
  const ekartSite = !direct && provider === "ekart" && Boolean(shipment.awb);
  let fromSite = false;
  if (ekartSite) {
    const site = await courierWebTrack("ekart", shipment.awb, (creds.tracker ?? {}) as TrackerCreds).catch(() => null);
    if (site?.events?.length) {
      fromSite = true;
      hit = { ...hit, events: site.events.map((event) => ({ ...event, src: "site" as const })) };
    } else if ((shipment.tracking ?? []).some((event) => event.src === "site")) {
      // The site was briefly unreachable: keep its saved list rather than mixing in API codes.
      hit = { ...hit, events: [] };
      fromSite = true;
    }
  }
  // India Post scans name the post office ("A.R. Shala S.O"); a town lookup would misplace it.
  if (direct !== "india-post") hit.events = await withScanPlaces(hit.events ?? []).catch(() => hit?.events ?? []);

  // Courier tracking pages show only the latest scans, so keep earlier ones; drop anything dated in the future.
  const latestOk = Date.now() + 10 * 60_000;
  const fresh = hit.events ?? [];
  const sameScan = (x: { status: string; location?: string }, y: { status: string; location?: string }) =>
    x.status.trim().toLowerCase() === y.status.trim().toLowerCase() && placeKey(x.location) === placeKey(y.location);
  // A re-read scan replaces the stored copy, so an earlier wrong timestamp is corrected rather than duplicated.
  const kept = (shipment.tracking ?? []).filter((old) => !fromSite || old.src === "site");
  const merged = direct || provider === "ekart"
    ? [...kept.filter((old) => !fresh.some((event) => sameScan(event, old))), ...fresh]
    : fresh.length
      ? fresh
      : shipment.tracking ?? [];
  const events = dedupe(
    merged
      .filter((event) => (Date.parse(event.at) || 0) <= latestOk && !(shipment.hiddenScans ?? []).includes(`${event.at}|${event.status.trim().toLowerCase()}`))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  );
  const courier = direct ? shipment.courier : customerCourierLabel({ provider, courier: hit.courierName || shipment.courier });
  const awb = hit.awb || shipment.awb;
  // The latest scan in context wins ("Dispatched to <hub>" after pickup is in transit); the courier's headline status only if it is further along.
  const scans = events;
  const sequence = classifyScanSequence(scans.map((event) => event.status));
  const lastIndex = sequence.findLastIndex((mapped) => Boolean(mapped));
  const headline = cleanScanText(hit.status ?? "");
  const headlineStage = headline ? classifyCourierScan(headline) : null;
  let stage = lastIndex >= 0 ? sequence[lastIndex] : null;
  let latestStatus = lastIndex >= 0 ? scans[lastIndex].status : headline;
  if (headlineStage && (!stage || courierStageRank(headlineStage) > courierStageRank(stage))) {
    stage = headlineStage;
    latestStatus = headline;
  }
  if (stage === "shipped" && onlyRoutingScans([...scans.map((event) => event.status), headline].filter(Boolean))) stage = "packed";
  const orderForLeg = findShopOrder(orderId);
  const hyperlocal = isHyperlocalProvider(provider, orderForLeg?.courierChoice?.lastMile, hit.courierName || shipment.courier || orderForLeg?.courierName);
  const shipmentStatus = stage ? shipmentStatusFor(stage) : undefined;
  const next: ShipmentRecord = {
    ...shipment,
    courier,
    awb,
    status: shipmentStatus ?? shipment.status,
    tracking: events.length ? events : shipment.tracking,
    trackingUrl: direct ? shipment.trackingUrl || hit.trackingUrl : hit.trackingUrl || shipment.trackingUrl,
    agentName: hit.accepted === false || stage === "delivered" ? "" : hit.agentName || shipment.agentName,
    agentPhone: hit.accepted === false || stage === "delivered" ? "" : hit.agentPhone || shipment.agentPhone,
    agentLat: hit.accepted === false || stage === "delivered" ? undefined : hit.lat ?? shipment.agentLat,
    agentLng: hit.accepted === false || stage === "delivered" ? undefined : hit.lng ?? shipment.agentLng,
    agentLeg: hit.agentLeg ?? shipment.agentLeg,
    pickupLat: hit.pickupLat ?? shipment.pickupLat,
    pickupLng: hit.pickupLng ?? shipment.pickupLng,
    dropLat: hit.dropLat ?? shipment.dropLat,
    dropLng: hit.dropLng ?? shipment.dropLng,
    deliveryOtp: hit.otp || shipment.deliveryOtp,
    expectedBy: stage === "delivered" ? "" : hit.expectedBy || shipment.expectedBy,
  };
  replaceShopShipment(next);
  const order = orderForLeg;
  if (order) {
    const rank: Record<string, number> = { Packed: 1, "Ready to Ship": 1, "To Ship": 1, Shipped: 2, "Out for Delivery": 3, Delivered: 4, Failed: 5 };
    const own = stage ? orderStatusFor(stage, hyperlocal) : undefined;
    let target = own;
    // A split order moves only as far as its slowest shipment: Delivered once every shipment is delivered.
    if (next.part) {
      if (own && own !== shipment.orderStatus) replaceShopShipment({ ...next, orderStatus: own });
      const parts = listShopShipments().filter((item) => item.orderId === orderId && item.part && item.note !== "Cancelled");
      if (parts.length >= 2) {
        const statusOf = (item: ShipmentRecord): Order["status"] => (item.id === next.id ? own : item.orderStatus) || "Packed";
        const slowest = parts.map(statusOf).sort((a, b) => (rank[a] ?? 0) - (rank[b] ?? 0))[0];
        if (own && own !== shipment.orderStatus && own !== slowest) {
          patchShopOrder(orderId, {
            history: [...(findShopOrder(orderId)?.history ?? []), { at: new Date().toISOString(), status: `Shipment ${next.part} of ${parts.length} ${own.toLowerCase()}`, note: latestStatus }],
          });
        }
        target = slowest === "Packed" ? undefined : slowest;
      }
    }
    const wrongDelivered =
      order.status === "Delivered" &&
      stage !== "delivered" &&
      Boolean(target) &&
      isCourierInfoLine([...(order.history ?? [])].reverse().find((entry) => entry.status === "Delivered")?.note ?? "");
    const move = Boolean(target && (wrongDelivered || ((rank[target] ?? 0) >= (rank[order.status] ?? 0) && order.status !== target)));
    if (move || order.courierName !== courier || (awb && order.trackingId !== awb)) {
      patchShopOrder(orderId, {
        courierName: courier,
        trackingId: awb || order.trackingId,
        ...(move ? { status: target, history: [...(order.history ?? []), { at: new Date().toISOString(), status: target!, note: wrongDelivered ? `Corrected from courier: ${latestStatus}` : latestStatus }] } : {}),
      });
    }
    if (move && target === "Delivered") {
      void issueDeliveryInvoice(orderId);
      void inviteOrderFeedback(orderId);
    }
  }
  return {
    ok: true as const,
    live: true as const,
    shipment: next,
    status: cleanScanText(hit.status ?? ""),
    order: findShopOrder(orderId) ?? order,
  };
}
