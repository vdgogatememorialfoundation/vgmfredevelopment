import { isCourierInfoLine } from "@/lib/order-pipeline";
import { courierTrackingLink, directCourier } from "@/lib/couriers";
import type { CourierRate, Order, ShipmentRecord } from "@/types";
import { customerCourierLabel, fleetCourierLabel, isOwnFleet } from "@/lib/courier-label";
import { deliveryDatePhrase, formatIndiaClock } from "@/lib/delivery-expectation";
import { checkPincode } from "@/lib/fulfillment";
import { getIntegrations, hasShippingCredentials, recordShippingConnection, type IntegrationSettings, type ShippingProviderId } from "@/lib/integrations";
import { requiresLiveCommerce } from "@/lib/platform";
import {
  getOrder,
  getShipments,
  patchOrder,
  patchShipment,
  removeOrderShipments,
  printShippingLabel,
  saveShipmentRecord,
  sendEmail,
} from "@/lib/admin-store";
import { getLiveBooks } from "@/lib/product-data";

type ShippingCreds = Record<string, Record<string, unknown>>;

function credsFrom(settings: IntegrationSettings): ShippingCreds {
  const { shiprocket, nimbuspost, ithink, shipyaari, tookan, shipday, tracker } = settings.shipping;
  return { shiprocket, nimbuspost, ithink, shipyaari, tookan, shipday, tracker: tracker ?? {} };
}

/** Couriers without an API account: read scans from the courier's own site (or the saved tracking service). */
async function trackDirect(shipment: ShipmentRecord) {
  const result = await post<TrackHit>({
    action: "track",
    provider: "courier-site",
    courier: shipment.directCourier,
    awb: shipment.awb,
    creds: credsFrom(getIntegrations()),
  });
  if (!result.ok) return null;
  return { result, saved: applyTrackHit(shipment, { ...result, courierName: shipment.courier, trackingUrl: shipment.trackingUrl || result.trackingUrl }) };
}

const WALLET_PROVIDERS = ["shiprocket", "nimbuspost", "ithink", "shipyaari"] as const;
export const CHECKOUT_PROVIDERS = ["shiprocket", "nimbuspost", "ithink", "shipyaari"] as const;

export function lastMileLabel(provider?: string, lastMile?: string, courier?: string) {
  const partner = customerCourierLabel({ provider, courier });
  if (lastMile === "porter") return `${partner} · Porter`;
  if (lastMile === "shadowfax") return `${partner} · Shadowfax Flash`;
  if (lastMile === "flash") return `${partner} · Flash`;
  return partner;
}

const REAL_CHECKOUT = new Set(["shiprocket", "nimbuspost", "ithink", "shipyaari", "tookan", "tookan-parcel", "shipday"]);

export function checkoutCourierRates(rates: CourierRate[]) {
  return rates.filter((rate) => REAL_CHECKOUT.has(rate.provider) && rate.live !== false);
}

function connectedCourierRates(deliveryPincode: string): CourierRate[] {
  const settings = getIntegrations();
  const origin = (settings.shipping.pickup.pincode || "411005").replace(/\D/g, "").slice(0, 3);
  const pin = deliveryPincode.replace(/\D/g, "");
  const sameCity = pin.length === 6 && origin.length === 3 && pin.startsWith(origin);
  const rates: CourierRate[] = [];
  if (hasShippingCredentials("tookan", settings)) {
    const tookan = settings.shipping.tookan;
    if (tookan.hyperlocal && sameCity) {
      rates.push({ provider: "tookan", courierId: "tookan", courierName: fleetCourierLabel("tookan"), rate: 39, etaDays: 0, live: true });
    }
    if (tookan.parcel && (!sameCity || !tookan.hyperlocal)) {
      rates.push({
        provider: "tookan-parcel",
        courierId: "tookan-parcel",
        courierName: fleetCourierLabel("tookan-parcel"),
        rate: 45,
        etaDays: sameCity ? 1 : 3,
        live: true,
      });
    }
  }
  if (hasShippingCredentials("shipday", settings) && settings.shipping.shipday.enabled !== false && sameCity) {
    rates.push({ provider: "shipday", courierId: "shipday", courierName: fleetCourierLabel("shipday"), rate: 49, etaDays: 0, live: true });
  }
  return rates;
}

export function publicTrackingUrl(shipment: Pick<ShipmentRecord, "awb" | "provider" | "trackingUrl">) {
  if (shipment.trackingUrl) return shipment.trackingUrl;
  const awb = shipment.awb;
  if (!awb) return "";
  if (shipment.provider === "shiprocket") return `https://shiprocket.co/tracking/${awb}`;
  if (shipment.provider === "nimbuspost") return `https://ship.nimbuspost.com/?awb=${awb}`;
  if (shipment.provider === "ithink") return `https://www.ithinklogistics.com/track-order?awb=${awb}`;
  if (shipment.provider === "shipyaari") return `https://shipyaari.com/track/${awb}`;
  return "";
}

export async function checkCourierWallet(provider: string, needed = 0) {
  if (!WALLET_PROVIDERS.includes(provider as (typeof WALLET_PROVIDERS)[number])) {
    return { ok: true as const, skipped: true };
  }
  const settings = getIntegrations();
  const floor = Math.max(settings.shipping.minWalletRupees || 0, needed);
  const result = await post<{ balance?: number }>({ action: "wallet", provider, creds: credsFrom(settings) });
  if (!result.ok) {
    if (result.configured === false) return { ok: true as const, skipped: true };
    throw new Error(`Could not read ${label(provider)} credits: ${result.error ?? "unknown error"}. Booking is blocked until the wallet can be checked.`);
  }
  const balance = Number(result.balance ?? 0);
  if (!Number.isFinite(balance) || balance < floor) {
    throw new Error(
      `${label(provider)} credits are too low (₹${Number.isFinite(balance) ? balance : 0}). Top up the wallet to at least ₹${floor} before booking a shipment.`
    );
  }
  return { ok: true as const, balance };
}

async function post<T>(body: Record<string, unknown>): Promise<T & { ok: boolean; configured?: boolean; error?: string }> {
  const response = await fetch("/api/shipping", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

export function orderWeightKg(order: Pick<Order, "items" | "weightKg">, settings = getIntegrations()) {
  if (order.weightKg) return order.weightKg;
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return Math.max(settings.shipping.defaultWeightKg, Math.round(units * settings.shipping.defaultWeightKg * 100) / 100);
}

export type RateQuote = {
  rates: CourierRate[];
  live: boolean;
  notes: string[];
};

/** Live aggregator rates when credentials exist (admin settings or host env), otherwise the partner table in Delivery Partners. */
export async function fetchCourierRates(input: {
  deliveryPincode: string;
  weightKg: number;
  cod?: boolean;
  declaredValue: number;
  bookIds?: string[];
  pickupPincode?: string;
}): Promise<RateQuote> {
  const settings = getIntegrations();
  const { shipping } = settings;
  const notes: string[] = [];
  // Keys may live only on the host (customer browsers never hold them); the server reports unconfigured accounts.
  const wanted = CHECKOUT_PROVIDERS.filter((id) => shipping[id].enabled);
  let live: CourierRate[] = [];
  if (/^\d{6}$/.test(input.deliveryPincode) && wanted.length) {
    try {
      const result = await post<{ rates: Omit<CourierRate, "provider">[] & { provider: string }[]; providers: { provider: string; configured: boolean; error?: string }[] }>({
        action: "rates",
        providers: wanted,
        creds: credsFrom(settings),
        parcel: {
          pickupPincode: input.pickupPincode || shipping.pickup.pincode,
          deliveryPincode: input.deliveryPincode,
          weightKg: input.weightKg,
          cod: Boolean(input.cod),
          declaredValue: input.declaredValue,
          length: shipping.packageCm.length,
          breadth: shipping.packageCm.breadth,
          height: shipping.packageCm.height,
        },
      });
      live = (result.rates ?? []).map((rate) => ({ ...(rate as unknown as CourierRate), live: true }));
      for (const provider of result.providers ?? []) {
        if (provider.error) notes.push(`${label(provider.provider)}: ${provider.error}`);
        else if (!provider.configured) notes.push(`${label(provider.provider)} credentials are not configured.`);
      }
    } catch {
      notes.push("Courier rate service could not be reached.");
    }
  }
  const connected = connectedCourierRates(input.deliveryPincode);
  const checkoutLive = checkoutCourierRates(live);
  const seen = new Set(checkoutLive.map((rate) => `${rate.provider}:${rate.courierId}`));
  const rates = [...checkoutLive, ...connected.filter((rate) => !seen.has(`${rate.provider}:${rate.courierId}`))];
  if (rates.length) {
    return {
      rates: rates.sort((a, b) => a.etaDays - b.etaDays || a.rate - b.rate),
      live: true,
      notes,
    };
  }

  const quote = checkPincode(input.deliveryPincode, input.bookIds?.[0]);
  if (!quote.serviceable && quote.note) notes.push(quote.note);
  if (!notes.length) notes.push("No live courier is connected for this pincode. Save a Tookan, Shiprocket, Nimbuspost, iThink, Shipyaari or Shipday key in Settings → Shipping APIs.");
  return { rates: [], live: false, notes };
}

function label(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function pickRate(rates: CourierRate[], rule = getIntegrations().shipping.rateChoice) {
  if (!rates.length) return undefined;
  if (rule === "fastest") return [...rates].sort((a, b) => a.etaDays - b.etaDays || a.rate - b.rate)[0];
  return [...rates].sort((a, b) => a.rate - b.rate || a.etaDays - b.etaDays)[0];
}

function bookingPayload(order: Order, choice: CourierRate, settings: IntegrationSettings, pickup = settings.shipping.pickup) {
  const address = order.deliveryAddress;
  const books = getLiveBooks();
  return {
    orderId: order.id,
    orderDate: order.date,
    courierId: choice.provider === "local" ? "" : choice.courierId,
    cod: order.paymentMethod === "Cash on delivery" && order.paymentStatus !== "Paid",
    total: order.total,
    subtotal: order.subtotal,
    shippingCharge: order.shipping,
    weightKg: orderWeightKg(order, settings),
    length: settings.shipping.packageCm.length,
    breadth: settings.shipping.packageCm.breadth,
    height: settings.shipping.packageCm.height,
    customer: {
      name: address?.fullName ?? "Customer",
      phone: address?.phone ?? "",
      email: address?.email,
      line1: address?.line1 ?? "",
      line2: address?.landmark,
      city: address?.city ?? "",
      state: address?.state ?? "",
      pincode: address?.pincode ?? "",
    },
    pickup,
    items: order.items.map((item) => ({
      name: item.title,
      sku: books.find((book) => book.id === item.bookId)?.sku ?? item.bookId,
      units: item.quantity,
      price: item.price,
    })),
  };
}

export type BookingResult = { shipment: ShipmentRecord; live: boolean; message: string };

function statusAfterBooking(status: Order["status"]): Order["status"] {
  if (status === "Ready to Ship") return "Ready to Ship";
  if (status === "Ordered" || status === "Pending" || status === "Processing" || status === "Accepted") return "Packed";
  return status;
}

/**
 * Books the courier for an order. With live aggregator credentials the
 * aggregator charges its wallet for the AWB; the ledger keeps what the
 * customer paid next to what the courier cost.
 */
export async function bookShipment(orderId: string, override?: CourierRate, pickupOverride?: Partial<IntegrationSettings["shipping"]["pickup"]>): Promise<BookingResult> {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.deliveryMode !== "delivery") throw new Error("Store pickup orders do not need a courier.");
  const existing = getShipments().find((shipment) => shipment.orderId === order.id && shipment.note !== "Cancelled");
  if (existing) return { shipment: existing, live: Boolean(existing.live), message: `Already booked with ${existing.courier} (${existing.awb}).` };

  const settings = getIntegrations();
  const pickup = { ...settings.shipping.pickup, ...pickupOverride };
  let choice = override ?? order.courierChoice;
  if (!choice) {
    const quote = await fetchCourierRates({
      deliveryPincode: order.deliveryAddress?.pincode ?? "",
      weightKg: orderWeightKg(order, settings),
      declaredValue: order.total,
      bookIds: order.items.map((item) => item.bookId),
    });
    choice = pickRate(quote.rates);
  }
  if (!choice) throw new Error("No courier services this pincode. Check Delivery Partners or the shipping API settings.");
  if (choice.provider !== "local") {
    await checkCourierWallet(choice.provider === "tookan-parcel" ? "tookan" : choice.provider, choice.rate);
  }

  const base: ShipmentRecord = {
    id: String(Date.now()),
    orderId: order.id,
    courier: choice.courierName,
    awb: "",
    charges: choice.rate,
    toAddress: { ...(order.deliveryAddress ?? { fullName: "", phone: "", line1: "", city: "", state: "", pincode: "" }) },
    items: order.items.map((item) => ({ sku: item.bookId, title: item.title, quantity: item.quantity })),
    status: "Booked",
    generatedAt: new Date().toISOString(),
    provider: choice.provider,
    courierCost: choice.rate,
    customerPaid: order.shipping,
    tracking: [{ at: new Date().toISOString(), status: "Shipment booked" }],
  };

  if (choice.provider === "local" || !REAL_CHECKOUT.has(choice.provider)) {
    throw new Error(`${choice.courierName} is not a live courier account. Choose Tookan, Shiprocket, Nimbuspost, iThink, Shipyaari or Shipday.`);
  }
  if (requiresLiveCommerce() && choice.live === false) {
    throw new Error("Staging and the live site only book real couriers. This rate is not from a connected account.");
  }

  const result = await post<{
    awb: string;
    courierName: string;
    providerOrderId?: string;
    providerShipmentId?: string;
    labelUrl?: string;
    invoiceUrl?: string;
    manifestUrl?: string;
    pickupScheduledFor?: string;
    pickupReference?: string;
    courierCost?: number;
    trackingUrl?: string;
  }>({
    action: "book",
    provider: choice.provider,
    creds: credsFrom(settings),
    order: bookingPayload(order, choice, settings, pickup),
    schedulePickup: settings.shipping.autoSchedulePickup,
  });
  if (!result.ok || !result.awb) {
    throw new Error(
      result.configured
        ? `${label(choice.provider)} refused the booking: ${result.error || "no tracking number was returned."}`
        : `${label(choice.provider)} credentials are missing. Save the API key in Settings → Shipping APIs.`
    );
  }
  const shipment: ShipmentRecord = {
    ...base,
    awb: result.awb,
    courier: customerCourierLabel({ provider: choice.provider, courier: result.courierName || choice.courierName }),
    live: true,
    providerOrderId: result.providerOrderId,
    providerShipmentId: result.providerShipmentId,
    labelUrl: result.labelUrl || undefined,
    invoiceUrl: result.invoiceUrl || undefined,
    manifestUrl: result.manifestUrl || undefined,
    pickupScheduledFor: result.pickupScheduledFor || undefined,
    pickupReference: result.pickupReference || undefined,
    courierCost: result.courierCost ?? choice.rate,
    trackingUrl: result.trackingUrl || undefined,
    note: `Booked on ${label(choice.provider)}.`,
  };
  const message = `Booked on ${label(choice.provider)} with ${shipment.courier}. AWB ${shipment.awb}.`;

  saveShipmentRecord(shipment);
  patchOrder(
    order.id,
    {
      shipmentId: shipment.id,
      trackingId: shipment.awb,
      courierName: shipment.courier,
      courierChoice: choice,
      status: statusAfterBooking(order.status),
    },
    `Courier booked · ${shipment.courier} ${shipment.awb}`
  );
  sendEmail({
    to: order.deliveryAddress?.email ?? "",
    phone: order.deliveryAddress?.phone,
    name: order.deliveryAddress?.fullName,
    params: [order.deliveryAddress?.fullName ?? "Customer", order.id, shipment.courier, shipment.awb],
    subject: `Order ${order.id} is packed and booked with ${shipment.courier}`,
    template: "shipment-booked",
    body: `Dear Guest,\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nYour order ${order.id} is packed. Courier: ${shipment.courier}. Tracking number: ${shipment.awb}.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return { shipment, live: Boolean(shipment.live), message };
}

export const MANUAL_PORTALS: { id: Exclude<CourierRate["provider"], "local" | "tookan-parcel">; label: string }[] = [
  { id: "shiprocket", label: "Shiprocket" },
  { id: "nimbuspost", label: "Nimbuspost" },
  { id: "ithink", label: "iThink Logistics" },
  { id: "shipyaari", label: "Shipyaari" },
  { id: "tookan", label: "Gogate Products (Tookan)" },
  { id: "shipday", label: "Gogate Products (Shipday)" },
];

/** Attach a parcel that was shipped outside Pack & book. The portal is asked for scans and the delivery time. */
/** Parcel sent with a courier that has no connected API: keep its id, tracking page and manual updates. */
export async function attachDirectTracking(orderId: string, courierId: string, awb: string, courierName = "") {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.deliveryMode !== "delivery") throw new Error("Store pickup orders do not use a courier tracking id.");
  const trackingId = awb.trim();
  if (trackingId.length < 3) throw new Error("Paste the tracking id from the courier.");
  const courierInfo = directCourier(courierId);
  const courier = courierName.trim() || courierInfo?.label || "Courier";
  const shipment: ShipmentRecord = {
    id: String(Date.now()),
    orderId: order.id,
    courier,
    awb: trackingId,
    charges: 0,
    toAddress: { ...(order.deliveryAddress ?? { fullName: "", phone: "", line1: "", city: "", state: "", pincode: "" }) },
    items: order.items.map((item) => ({ sku: item.bookId, title: item.title, quantity: item.quantity })),
    status: "Booked",
    generatedAt: new Date().toISOString(),
    live: false,
    directCourier: courierInfo?.id ?? "other",
    trackingUrl: courierTrackingLink(courierInfo?.id, trackingId) || undefined,
    note: `Sent with ${courier}.`,
    tracking: [{ at: new Date().toISOString(), status: `Handed to ${courier}` }],
  };
  saveShipmentRecord(shipment);
  patchOrder(order.id, { shipmentId: shipment.id, trackingId, courierName: courier }, `Tracking ${trackingId} attached from ${courier}`);
  const fetched = await trackDirect(shipment).catch(() => null);
  if (fetched?.result.status) return `${courier} · ${trackingId} attached. Latest from ${courier}: ${fetched.result.status}. Status updates are fetched automatically.`;
  return `${courier} · ${trackingId} attached. ${shipment.trackingUrl ? "No scans on the courier site yet; they are fetched automatically." : "Add status updates from the shipment as they come in."}`;
}

export async function attachManualTracking(orderId: string, portal: (typeof MANUAL_PORTALS)[number]["id"], awb: string, courierName = "") {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.deliveryMode !== "delivery") throw new Error("Store pickup orders do not use a courier tracking id.");
  const trackingId = awb.trim();
  if (trackingId.length < 3) throw new Error("Paste the tracking id from the courier.");
  const result = await post<TrackHit>({
    action: "track",
    provider: portal,
    creds: credsFrom(getIntegrations()),
    awb: trackingId,
    providerOrderId: trackingId,
    providerShipmentId: trackingId,
  });
  if (!result.ok) {
    throw new Error(result.error || `${label(portal)} did not return this tracking id. Check the id and that the API key is saved.`);
  }
  const courier = customerCourierLabel({ provider: portal, courier: result.courierName || courierName || label(portal) });
  const shipment: ShipmentRecord = {
    id: String(Date.now()),
    orderId: order.id,
    courier,
    awb: result.awb || trackingId,
    charges: 0,
    toAddress: { ...(order.deliveryAddress ?? { fullName: "", phone: "", line1: "", city: "", state: "", pincode: "" }) },
    items: order.items.map((item) => ({ sku: item.bookId, title: item.title, quantity: item.quantity })),
    status: "Booked",
    generatedAt: new Date().toISOString(),
    provider: portal,
    live: true,
    providerOrderId: trackingId,
    providerShipmentId: trackingId,
    trackingUrl: result.trackingUrl,
    expectedBy: result.expectedBy,
    note: `Tracking pasted from ${label(portal)}.`,
    tracking: result.events?.length ? result.events : [{ at: new Date().toISOString(), status: result.status || "Tracking attached" }],
  };
  saveShipmentRecord(shipment);
  const saved = applyTrackHit(shipment, result);
  patchOrder(
    order.id,
    {
      shipmentId: saved.id,
      trackingId: saved.awb,
      courierName: saved.courier,
      courierChoice: { provider: portal, courierId: portal, courierName: courier, rate: 0, etaDays: 0, live: true },
    },
    `Tracking ${saved.awb} attached from ${label(portal)}`
  );
  const when = saved.expectedBy ? ` Delivery ${deliveryDatePhrase(saved.expectedBy)}.` : " The courier has not sent a delivery date yet.";
  return `Fetched from ${label(portal)}. ${saved.courier} · ${saved.awb}. Status: ${result.status || saved.status}.${when}`;
}

export async function schedulePickup(shipmentId: string, date: string, slot: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (shipment.live && shipment.provider === "shiprocket" && shipment.providerShipmentId) {
    const result = await post<{ pickupScheduledFor: string; pickupReference: string }>({
      action: "pickup",
      provider: "shiprocket",
      creds: credsFrom(getIntegrations()),
      shipmentId: shipment.providerShipmentId,
      pickupDate: date,
    });
    if (!result.ok) throw new Error(result.error ?? "Shiprocket could not schedule the pickup.");
    patchShipment(shipmentId, { pickupScheduledFor: result.pickupScheduledFor || date, pickupSlot: slot, pickupReference: result.pickupReference });
    return `Shiprocket pickup scheduled for ${result.pickupScheduledFor || date}.`;
  }
  patchShipment(shipmentId, { pickupScheduledFor: date, pickupSlot: slot });
  return shipment.live
    ? `${label(shipment.provider ?? "courier")} schedules pickups automatically; the slot is saved for your team.`
    : `Pickup noted for ${date}, ${slot}.`;
}

type LabelFetch = {
  labelUrl?: string;
  routingCode?: string;
  destination?: string;
  courierName?: string;
  awb?: string;
};

export async function downloadLabel(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  const provider = shipment.provider;
  const fetched = new Set(["shiprocket", "nimbuspost", "shipyaari"]);
  let details: LabelFetch = {
    labelUrl: shipment.labelUrl,
    routingCode: shipment.routingCode,
    destination: shipment.destinationHub,
    courierName: shipment.courier,
    awb: shipment.awb,
  };
  if (shipment.live && provider && fetched.has(provider) && (shipment.awb || shipment.providerShipmentId)) {
    const result = await post<LabelFetch>({
      action: "label",
      provider,
      creds: credsFrom(getIntegrations()),
      shipmentId: shipment.providerShipmentId,
      awb: shipment.awb,
    });
    if (result.ok) {
      details = {
        labelUrl: result.labelUrl || details.labelUrl,
        routingCode: result.routingCode || details.routingCode,
        destination: result.destination || details.destination,
        courierName: result.courierName || details.courierName,
        awb: result.awb || details.awb,
      };
      patchShipment(shipmentId, {
        labelUrl: details.labelUrl,
        routingCode: details.routingCode,
        destinationHub: details.destination,
      });
    }
  } else if (shipment.live && provider === "ithink" && shipment.awb && !shipment.labelUrl) {
    const result = await post<{ labelUrl: string }>({
      action: "label",
      provider: "ithink",
      creds: credsFrom(getIntegrations()),
      awb: shipment.awb,
    });
    if (result.ok && result.labelUrl) {
      details.labelUrl = result.labelUrl;
      patchShipment(shipmentId, { labelUrl: result.labelUrl });
    }
  }
  const latest = getShipments().find((item) => item.id === shipmentId) ?? shipment;
  printShippingLabel(latest, details);
  const fromPortal = fetched.has(provider ?? "") && shipment.live ? ` using the ${label(provider ?? "courier")} shipment` : "";
  return `Printed the shipping label${fromPortal}.`;
}

/** Gogate Products only. Customers see the date. The clock is kept for the tracking line and the courier task. */
export async function rescheduleOwnDelivery(shipmentId: string, localValue: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (!isOwnFleet(shipment.provider)) throw new Error("Delivery time can be changed only for Gogate Products deliveries.");
  const match = localValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error("Choose a delivery date and time.");
  const wall = `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:00`;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])) - 5.5 * 60 * 60 * 1000;
  const expectedBy = formatIndiaClock(ms);
  const shown = deliveryDatePhrase(expectedBy);
  let portal = "";
  if (shipment.live && (shipment.provider === "tookan" || shipment.provider === "tookan-parcel" || shipment.provider === "shipday")) {
    const result = await post<{ updated?: boolean }>({
      action: "reschedule",
      provider: shipment.provider,
      creds: credsFrom(getIntegrations()),
      jobId: shipment.providerShipmentId || shipment.awb,
      extraId: shipment.providerOrderId || "",
      providerOrderId: shipment.providerOrderId || shipment.awb,
      deliveryAt: wall,
    });
    portal = result.ok ? " The courier task was updated." : " The date is saved here. The courier portal could not be updated.";
  }
  patchShipment(shipmentId, { expectedBy });
  patchOrder(shipment.orderId, { eta: shown }, `Delivery rescheduled to ${shown}`);
  return `Delivery date set to ${shown}.${portal} Customers see the date only.`;
}

export async function downloadInvoice(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (shipment.invoiceUrl) {
    window.open(shipment.invoiceUrl, "_blank", "noopener");
    return "Opened the courier invoice.";
  }
  if (shipment.live && shipment.provider === "shiprocket" && shipment.providerOrderId) {
    const result = await post<{ invoiceUrl: string }>({
      action: "invoice",
      provider: "shiprocket",
      creds: credsFrom(getIntegrations()),
      providerOrderId: shipment.providerOrderId,
    });
    if (result.ok && result.invoiceUrl) {
      patchShipment(shipmentId, { invoiceUrl: result.invoiceUrl });
      window.open(result.invoiceUrl, "_blank", "noopener");
      return "Opened the Shiprocket invoice.";
    }
    throw new Error(result.error ?? "Shiprocket did not return an invoice URL.");
  }
  if (shipment.live && shipment.provider === "ithink" && shipment.awb) {
    const result = await post<{ invoiceUrl: string }>({
      action: "invoice",
      provider: "ithink",
      creds: credsFrom(getIntegrations()),
      awb: shipment.awb,
    });
    if (result.ok && result.invoiceUrl) {
      patchShipment(shipmentId, { invoiceUrl: result.invoiceUrl });
      window.open(result.invoiceUrl, "_blank", "noopener");
      return "Opened the iThink Logistics invoice.";
    }
  }
  throw new Error("Courier invoices are generated after a live booking on Shiprocket or iThink.");
}

export async function downloadManifest(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (shipment.manifestUrl) {
    window.open(shipment.manifestUrl, "_blank", "noopener");
    return "Opened the pickup manifest.";
  }
  if (shipment.live && shipment.provider === "shiprocket" && shipment.providerShipmentId) {
    const result = await post<{ manifestUrl: string }>({
      action: "manifest",
      provider: "shiprocket",
      creds: credsFrom(getIntegrations()),
      shipmentId: shipment.providerShipmentId,
    });
    if (result.ok && result.manifestUrl) {
      patchShipment(shipmentId, { manifestUrl: result.manifestUrl });
      window.open(result.manifestUrl, "_blank", "noopener");
      return "Opened the Shiprocket manifest.";
    }
    throw new Error(result.error ?? "Shiprocket did not return a manifest URL.");
  }
  if (shipment.live && shipment.provider === "ithink" && shipment.awb) {
    const result = await post<{ manifestUrl: string }>({
      action: "manifest",
      provider: "ithink",
      creds: credsFrom(getIntegrations()),
      awb: shipment.awb,
    });
    if (result.ok && result.manifestUrl) {
      patchShipment(shipmentId, { manifestUrl: result.manifestUrl });
      window.open(result.manifestUrl, "_blank", "noopener");
      return "Opened the iThink Logistics manifest.";
    }
  }
  throw new Error("Pickup manifests are generated after a live booking on Shiprocket or iThink.");
}

export async function applyShiprocketWebhooks() {
  const result = await post<{ events: { awb?: string; status?: string; payload: Record<string, unknown> }[] }>({
    action: "webhook-events",
  });
  const events = result.events ?? [];
  let applied = 0;
  for (const event of events) {
    if (!event.awb) continue;
    const shipment = getShipments().find((item) => item.awb === event.awb);
    if (!shipment) continue;
    const mapped = mapCourierStatus(String(event.status ?? ""));
    const scans = Array.isArray((event.payload as { scans?: { date?: string; activity?: string; location?: string }[] }).scans)
      ? (event.payload as { scans: { date?: string; activity?: string; location?: string }[] }).scans.map((scan) => ({
          at: String(scan.date ?? new Date().toISOString()),
          status: String(scan.activity ?? event.status ?? ""),
          location: String(scan.location ?? ""),
        }))
      : shipment.tracking;
    patchShipment(shipment.id, { tracking: scans, status: mapped ?? shipment.status });
    if (mapped) syncOrderFromShipment(shipment.orderId, mapped);
    applied += 1;
  }
  return applied ? `Applied ${applied} Shiprocket tracking update${applied === 1 ? "" : "s"}.` : "No matching Shiprocket webhook events yet.";
}

/** Cancel the current booking and book a different courier. */
export async function reallocateCourier(orderId: string, choice?: CourierRate) {
  const existing = getShipments().find((item) => item.orderId === orderId && item.note !== "Cancelled");
  if (existing) await cancelShipment(existing.id);
  patchOrder(orderId, { shipmentId: undefined, trackingId: undefined }, "Courier reallocated");
  return bookShipment(orderId, choice);
}

/** Creates a reverse pickup on Shiprocket (or iThink) for a customer return. */
export async function createReturnShipment(orderId: string, provider: "shiprocket" | "ithink" = "shiprocket") {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  const settings = getIntegrations();
  const choice: CourierRate = {
    provider,
    courierId: order.courierChoice?.provider === provider ? order.courierChoice.courierId : "",
    courierName: provider === "shiprocket" ? "Shiprocket return" : "iThink return",
    rate: 0,
    etaDays: 3,
    live: true,
  };
  const result = await post<{
    awb: string;
    courierName: string;
    providerOrderId?: string;
    providerShipmentId?: string;
    courierCost?: number;
    labelUrl?: string;
  }>({
    action: "return",
    provider,
    creds: credsFrom(settings),
    order: bookingPayload(order, choice, settings),
  });
  if (!result.ok) {
    throw new Error(
      result.configured === false
        ? `${label(provider)} credentials are not configured, so the return was not booked.`
        : result.error ?? "Could not create the return shipment."
    );
  }
  return {
    live: true,
    awb: result.awb,
    courierName: result.courierName,
    providerOrderId: result.providerOrderId,
    providerShipmentId: result.providerShipmentId,
    labelUrl: result.labelUrl || undefined,
    note: `Return booked on ${label(provider)}. AWB ${result.awb}.`,
  };
}

const statusOrder: ShipmentRecord["status"][] = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];

function mapCourierStatus(text: string): ShipmentRecord["status"] | undefined {
  const value = text.toLowerCase().replace(/[_-]+/g, " ");
  if (isCourierInfoLine(value)) return undefined;
  if (/\b(rto|return to origin|undeliver|not delivered|delivery failed|failed delivery|consignee refused|lost|destroyed|incomplete)\b/.test(value)) {
    return "Failed";
  }
  if (/\b(already delivered|delivered|successful|completed)\b/.test(value) && !/\b(attempt|fail|undeliver)\b/.test(value)) return "Delivered";
  if (/\b(out for delivery|ready to deliver|started|in progress|on the way)\b/.test(value)) return "Out for Delivery";
  if (value.includes("transit") || value.includes("shipped") || value.includes("dispatch")) return "In Transit";
  if (/\bpicked/.test(value)) return "Picked Up";
  if (/\b(not assigned|not accepted|not started|booked)\b/.test(value)) return "Booked";
  return undefined;
}

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

function dedupeScans(events: { at: string; status: string; location?: string }[]) {
  const out: { at: string; status: string; location?: string }[] = [];
  for (const event of events) {
    const prev = out[out.length - 1];
    if (prev && prev.status === event.status && (prev.location ?? "") === (event.location ?? "")) continue;
    out.push(event);
  }
  return out;
}

function applyTrackHit(shipment: ShipmentRecord, result: TrackHit) {
  const events = dedupeScans(result.events?.length ? result.events : shipment.tracking ?? []);
  const courier = customerCourierLabel({ provider: shipment.provider, courier: result.courierName || shipment.courier });
  const awb = result.awb || shipment.awb;
  const mapped = result.status ? mapCourierStatus(result.status) : undefined;
  const update: Partial<ShipmentRecord> = {
    tracking: events.length ? events : shipment.tracking,
    status: mapped ?? shipment.status,
    trackingUrl: result.trackingUrl || shipment.trackingUrl,
    courier,
    awb,
  };
  if (result.agentName) update.agentName = result.agentName;
  if (result.agentPhone) update.agentPhone = result.agentPhone;
  if (result.otp) update.deliveryOtp = result.otp;
  if (result.lat != null) update.agentLat = result.lat;
  if (result.lng != null) update.agentLng = result.lng;
  if (result.pickupLat != null) update.pickupLat = result.pickupLat;
  if (result.pickupLng != null) update.pickupLng = result.pickupLng;
  if (result.dropLat != null) update.dropLat = result.dropLat;
  if (result.dropLng != null) update.dropLng = result.dropLng;
  if (result.agentLeg) update.agentLeg = result.agentLeg;
  if (mapped === "Delivered") update.expectedBy = "";
  else if (result.expectedBy) update.expectedBy = result.expectedBy;
  if (result.accepted === false) {
    update.agentName = "";
    update.agentPhone = "";
    update.agentLat = undefined;
    update.agentLng = undefined;
  }
  const saved = patchShipment(shipment.id, update) ?? { ...shipment, ...update };
  const order = getOrder(shipment.orderId);
  if (order && (order.courierName !== courier || (awb && order.trackingId !== awb))) {
    patchOrder(shipment.orderId, { courierName: courier, trackingId: awb || order.trackingId });
  }
  if (mapped) syncOrderFromShipment(shipment.orderId, mapped);
  return saved;
}

export async function trackShipment(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (shipment.live && shipment.provider && shipment.provider !== "local") {
    const result = await post<TrackHit>({
      action: "track",
      provider: shipment.provider,
      creds: credsFrom(getIntegrations()),
      awb: shipment.awb,
      providerOrderId: shipment.providerOrderId,
      providerShipmentId: shipment.providerShipmentId,
      orderNumber: shipment.orderId,
    });
    if (!result.ok) throw new Error(result.error ?? "Tracking failed.");
    applyTrackHit(shipment, result);
    return result.status || "No scan yet.";
  }
  if (shipment.directCourier) {
    const fetched = await trackDirect(shipment);
    if (!fetched) return `${shipment.status} · ${shipment.courier} has no new scans on its site yet.`;
    return fetched.result.status || fetched.saved.status;
  }
  return shipment.status;
}

export async function pingLiveAgent(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (!shipment.live && shipment.directCourier) {
    const fetched = await trackDirect(shipment).catch(() => null);
    if (fetched) {
      return {
        status: fetched.result.status || fetched.saved.status,
        events: fetched.saved.tracking ?? [],
        trackingUrl: publicTrackingUrl(fetched.saved),
        lat: undefined,
        lng: undefined,
      };
    }
  }
  if (!shipment.live || !shipment.provider || shipment.provider === "local") {
    return {
      status: shipment.status,
      events: shipment.tracking ?? [],
      trackingUrl: publicTrackingUrl(shipment),
      lat: shipment.agentLat,
      lng: shipment.agentLng,
    };
  }
  const result = await post<TrackHit>({
    action: "track",
    provider: shipment.provider,
    creds: credsFrom(getIntegrations()),
    awb: shipment.awb,
    providerOrderId: shipment.providerOrderId,
    providerShipmentId: shipment.providerShipmentId,
    orderNumber: shipment.orderId,
  });
  if (!result.ok) throw new Error(result.error ?? "Tracking failed.");
  const saved = applyTrackHit(shipment, result);
  return {
    status: result.status || saved.status,
    events: result.events?.length ? result.events : saved.tracking ?? [],
    lat: result.lat ?? saved.agentLat,
    lng: result.lng ?? saved.agentLng,
    trackingUrl: result.trackingUrl || publicTrackingUrl(saved),
  };
}

export function advanceDemoShipment(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) return;
  const next = statusOrder[Math.min(statusOrder.length - 1, statusOrder.indexOf(shipment.status) + 1)];
  patchShipment(shipmentId, {
    status: next,
    pickedUpAt: next === "Picked Up" ? new Date().toISOString() : shipment.pickedUpAt,
    tracking: [...(shipment.tracking ?? []), { at: new Date().toISOString(), status: next, location: shipment.toAddress.city }],
  });
  syncOrderFromShipment(shipment.orderId, next);
}

function syncOrderFromShipment(orderId: string, status: ShipmentRecord["status"]) {
  const order = getOrder(orderId);
  if (!order) return;
  const target: Order["status"] =
    status === "Failed"
      ? "Failed"
      : status === "Delivered"
        ? "Delivered"
        : status === "Out for Delivery"
          ? "Out for Delivery"
          : status === "Booked"
            ? "Packed"
            : "Shipped";
  if (order.status !== target) patchOrder(orderId, { status: target }, target);
}

/** Cancel the courier booking, then remove the shipment from the desk. */
export async function dropOrderShipments(orderId: string) {
  const rows = getShipments().filter((item) => item.orderId === orderId);
  for (const shipment of rows) {
    if (shipment.note === "Cancelled" || !shipment.live || !shipment.provider || shipment.provider === "local") continue;
    await post({
      action: "cancel",
      provider: shipment.provider,
      creds: credsFrom(getIntegrations()),
      providerOrderId: shipment.providerOrderId,
      providerShipmentId: shipment.providerShipmentId,
      awb: shipment.awb,
    }).catch(() => undefined);
  }
  removeOrderShipments(orderId);
}

export async function cancelShipment(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) return "Shipment not found.";
  if (shipment.live && shipment.provider && shipment.provider !== "local") {
    const result = await post({
      action: "cancel",
      provider: shipment.provider,
      creds: credsFrom(getIntegrations()),
      providerOrderId: shipment.providerOrderId,
      providerShipmentId: shipment.providerShipmentId,
      awb: shipment.awb,
    });
    if (!result.ok) throw new Error(result.error ?? "The courier did not cancel the shipment.");
  }
  patchShipment(shipmentId, { note: "Cancelled", tracking: [...(shipment.tracking ?? []), { at: new Date().toISOString(), status: "Cancelled" }] });
  return shipment.live ? "Courier shipment cancelled. The aggregator refunds the wallet per its policy." : "Shipment cancelled.";
}

export async function testShippingProvider(provider: string) {
  const result = await post<{ message?: string }>({ action: "test", provider, creds: credsFrom(getIntegrations()) });
  const id = (provider === "tookan-parcel" ? "tookan" : provider) as ShippingProviderId;
  if (["shiprocket", "nimbuspost", "ithink", "shipyaari", "tookan", "shipday"].includes(id)) {
    recordShippingConnection(
      id,
      result.ok ? "success" : "failed",
      result.ok ? result.message || "Connected from this site." : result.error || "The provider rejected the credentials."
    );
  }
  return result;
}

export async function testConfiguredShippingProviders() {
  const settings = getIntegrations();
  const wanted = (["shipday", "shiprocket", "ithink", "tookan", "nimbuspost", "shipyaari"] as const).filter((id) => hasShippingCredentials(id, settings));
  const results: { id: string; ok: boolean; message?: string; error?: string }[] = [];
  for (const id of wanted) {
    const result = await testShippingProvider(id);
    results.push({ id, ok: result.ok, message: result.message, error: result.error });
  }
  return results;
}

export async function syncPickupAddress() {
  const settings = getIntegrations();
  return post<{ saved?: boolean }>({
    action: "pickup-address",
    provider: "shiprocket",
    creds: credsFrom(settings),
    pickup: settings.shipping.pickup,
  });
}

export async function listPickupLocations() {
  return post<{ locations: { nickname: string; city: string; pincode: string; phone?: string; address?: string }[] }>({
    action: "pickup-locations",
    provider: "shiprocket",
    creds: credsFrom(getIntegrations()),
  });
}
