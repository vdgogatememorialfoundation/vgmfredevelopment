import { customerCourierLabel } from "@/lib/courier-label";
import { classifyCourierScan, isHyperlocalProvider } from "@/lib/order-pipeline";
import {
  ithinkTrack,
  nimbusTrack,
  shipdayTrack,
  shiprocketTrack,
  shipyaariTrack,
  tookanTrack,
} from "@/lib/server/providers";
import { findShopOrder, patchShopOrder } from "@/lib/server/shop-orders";
import { findShopShipment, replaceShopShipment } from "@/lib/server/shop-shipments";
import { readShippingCreds } from "@/lib/server/shipping-vault";
import type { Order, ShipmentRecord } from "@/types";

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

function dedupe(events: { at: string; status: string; location?: string }[]) {
  const out: { at: string; status: string; location?: string }[] = [];
  for (const event of events) {
    const prev = out[out.length - 1];
    if (prev && prev.status === event.status && (prev.location ?? "") === (event.location ?? "")) continue;
    out.push(event);
  }
  return out;
}

async function track(
  provider: string,
  awb: string,
  providerOrderId: string | undefined,
  extraId: string | undefined,
  creds: Record<string, Record<string, unknown>>
) {
  const own = creds[provider] ?? creds[provider.replace("-parcel", "")] ?? {};
  if (provider === "shiprocket") return shiprocketTrack(own, awb);
  if (provider === "nimbuspost") return nimbusTrack(own, awb);
  if (provider === "ithink") return ithinkTrack(creds.ithink ?? own, awb);
  if (provider === "shipyaari") return shipyaariTrack(creds.shipyaari ?? own, awb);
  if (provider === "tookan" || provider === "tookan-parcel") {
    return tookanTrack(creds.tookan ?? own, String(providerOrderId || awb), String(extraId || awb));
  }
  if (provider === "shipday") return shipdayTrack(own, String(providerOrderId ?? awb));
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
  if (stage === "packed") return "Packed";
  return undefined;
}

export async function refreshStoredShipment(orderId: string) {
  const shipment = findShopShipment(orderId);
  if (!shipment) return { ok: false as const, error: "Shipment not on the server yet." };
  const provider = shipment.provider;
  if (!shipment.live || !provider || provider === "local") {
    return { ok: true as const, live: false as const, shipment };
  }
  const creds = readShippingCreds() as Record<string, Record<string, unknown>>;
  let hit: TrackHit | null = null;
  try {
    hit = (await track(provider, shipment.awb, shipment.providerOrderId, shipment.providerShipmentId, creds)) as TrackHit | null;
  } catch {
    return { ok: true as const, live: false as const, shipment };
  }
  if (!hit) return { ok: true as const, live: false as const, shipment };

  const events = dedupe(hit.events?.length ? hit.events : shipment.tracking ?? []);
  const courier = customerCourierLabel({ provider, courier: hit.courierName || shipment.courier });
  const awb = hit.awb || shipment.awb;
  const latestStatus = hit.status || [...events].reverse().find((event) => event.status)?.status || "";
  const stage = classifyCourierScan(latestStatus);
  const orderForLeg = findShopOrder(orderId);
  const hyperlocal = isHyperlocalProvider(provider, orderForLeg?.courierChoice?.lastMile);
  const shipmentStatus = stage ? shipmentStatusFor(stage) : undefined;
  const next: ShipmentRecord = {
    ...shipment,
    courier,
    awb,
    status: shipmentStatus ?? shipment.status,
    tracking: events.length ? events : shipment.tracking,
    trackingUrl: hit.trackingUrl || shipment.trackingUrl,
    agentName: hit.accepted === false ? "" : hit.agentName || shipment.agentName,
    agentPhone: hit.accepted === false ? "" : hit.agentPhone || shipment.agentPhone,
    agentLat: hit.accepted === false ? undefined : hit.lat ?? shipment.agentLat,
    agentLng: hit.accepted === false ? undefined : hit.lng ?? shipment.agentLng,
    agentLeg: hit.agentLeg ?? shipment.agentLeg,
    pickupLat: hit.pickupLat ?? shipment.pickupLat,
    pickupLng: hit.pickupLng ?? shipment.pickupLng,
    dropLat: hit.dropLat ?? shipment.dropLat,
    dropLng: hit.dropLng ?? shipment.dropLng,
    deliveryOtp: hit.otp || shipment.deliveryOtp,
    expectedBy: hit.expectedBy || shipment.expectedBy,
  };
  replaceShopShipment(next);
  const order = orderForLeg;
  if (order) {
    const target = stage ? orderStatusFor(stage, hyperlocal) : undefined;
    const rank: Record<string, number> = { Packed: 1, Shipped: 2, "Out for Delivery": 3, Delivered: 4, Failed: 5 };
    const move = Boolean(target && (rank[target] ?? 0) >= (rank[order.status] ?? 0) && order.status !== target);
    if (move || order.courierName !== courier || (awb && order.trackingId !== awb)) {
      patchShopOrder(orderId, {
        courierName: courier,
        trackingId: awb || order.trackingId,
        ...(move ? { status: target, history: [...(order.history ?? []), { at: new Date().toISOString(), status: target!, note: latestStatus }] } : {}),
      });
    }
  }
  return {
    ok: true as const,
    live: true as const,
    shipment: next,
    status: hit.status ?? "",
    order: findShopOrder(orderId) ?? order,
  };
}
