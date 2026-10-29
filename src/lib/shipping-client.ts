import type { CourierRate, Order, ShipmentRecord } from "@/types";
import { checkPincode } from "@/lib/fulfillment";
import { getIntegrations, hasShippingCredentials, recordShippingConnection, type IntegrationSettings, type ShippingProviderId } from "@/lib/integrations";
import {
  generateAWB,
  getOrder,
  getShipments,
  patchOrder,
  patchShipment,
  printShippingLabel,
  saveShipmentRecord,
  sendEmail,
} from "@/lib/admin-store";
import { getLiveBooks } from "@/lib/product-data";

type ShippingCreds = Record<string, Record<string, unknown>>;

function credsFrom(settings: IntegrationSettings): ShippingCreds {
  const { shiprocket, nimbuspost, ithink, shipyaari, tookan, shipday } = settings.shipping;
  return { shiprocket, nimbuspost, ithink, shipyaari, tookan, shipday };
}

const WALLET_PROVIDERS = ["shiprocket", "nimbuspost", "ithink", "shipyaari"] as const;

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
}): Promise<RateQuote> {
  const settings = getIntegrations();
  const { shipping } = settings;
  const notes: string[] = [];
  const wanted = (["shiprocket", "nimbuspost", "ithink", "shipyaari"] as const).filter(
    (id) => shipping[id].enabled && hasShippingCredentials(id, settings)
  );
  let live: CourierRate[] = [];
  if (/^\d{6}$/.test(input.deliveryPincode) && wanted.length) {
    try {
      const result = await post<{ rates: Omit<CourierRate, "provider">[] & { provider: string }[]; providers: { provider: string; configured: boolean; error?: string }[] }>({
        action: "rates",
        providers: wanted,
        creds: credsFrom(settings),
        parcel: {
          pickupPincode: shipping.pickup.pincode,
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
  const extra: CourierRate[] = [];
  const pin = input.deliveryPincode;
  const originPrefix = (shipping.pickup.pincode || "411005").slice(0, 3);
  const sameCity = pin.startsWith(originPrefix);
  if (shipping.tookan.apiKey && /^\d{6}$/.test(pin)) {
    if (shipping.tookan.hyperlocal && sameCity) {
      extra.push({ provider: "tookan", courierId: "tookan", courierName: "Tookan hyperlocal (task)", rate: 39, etaDays: 0, live: true });
    }
    if (shipping.tookan.parcel) {
      extra.push({ provider: "tookan-parcel", courierId: "tookan-parcel", courierName: "Tookan parcel", rate: sameCity ? 45 : 69, etaDays: sameCity ? 1 : 3, live: true });
    }
  }
  if (shipping.shipday.enabled && shipping.shipday.apiKey && sameCity) {
    extra.push({ provider: "shipday", courierId: "shipday", courierName: "Shipday", rate: 45, etaDays: 0, live: true });
  }
  if (live.length || extra.length) return { rates: [...live, ...extra].sort((a, b) => a.rate - b.rate), live: true, notes };

  const quote = checkPincode(input.deliveryPincode, input.bookIds?.[0]);
  const rates: CourierRate[] = quote.offers.map((offer) => ({
    provider: "local",
    courierId: offer.id,
    courierName: offer.name,
    rate: offer.charge,
    etaDays: offer.transitDays,
    live: false,
  }));
  if (!quote.serviceable && quote.note) notes.push(quote.note);
  return { rates, live: false, notes };
}

function label(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function pickRate(rates: CourierRate[], rule = getIntegrations().shipping.rateChoice) {
  if (!rates.length) return undefined;
  if (rule === "fastest") return [...rates].sort((a, b) => a.etaDays - b.etaDays || a.rate - b.rate)[0];
  return [...rates].sort((a, b) => a.rate - b.rate || a.etaDays - b.etaDays)[0];
}

function bookingPayload(order: Order, choice: CourierRate, settings: IntegrationSettings) {
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
    pickup: settings.shipping.pickup,
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
export async function bookShipment(orderId: string, override?: CourierRate): Promise<BookingResult> {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.deliveryMode !== "delivery") throw new Error("Store pickup orders do not need a courier.");
  const existing = getShipments().find((shipment) => shipment.orderId === order.id && shipment.note !== "Cancelled");
  if (existing) return { shipment: existing, live: Boolean(existing.live), message: `Already booked with ${existing.courier} (${existing.awb}).` };

  const settings = getIntegrations();
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
    id: `SHP${Date.now()}`,
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

  let shipment: ShipmentRecord = { ...base, awb: generateAWB(choice.courierName), live: false, note: "Demo booking: no aggregator credentials, so no wallet was charged." };
  let message = `Demo booking with ${choice.courierName}. Add aggregator credentials in Settings → Shipping APIs to book for real.`;

  if (choice.provider !== "local") {
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
      order: bookingPayload(order, choice, settings),
      schedulePickup: settings.shipping.autoSchedulePickup,
    });
    if (!result.ok) {
      if (result.configured) throw new Error(`${label(choice.provider)} refused the booking: ${result.error}`);
    } else {
      shipment = {
        ...base,
        awb: result.awb,
        courier: result.courierName || choice.courierName,
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
        note: `Booked on ${label(choice.provider)}. The courier charge is debited from the ${label(choice.provider)} wallet.`,
      };
      message = `Booked on ${label(choice.provider)} with ${shipment.courier}. AWB ${shipment.awb}.`;
    }
  }

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
    body: `Your order ${order.id} is packed. Courier: ${shipment.courier}. Tracking number: ${shipment.awb}.\n\n– VGMF Store`,
  });
  return { shipment, live: Boolean(shipment.live), message };
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

export async function downloadLabel(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (shipment.labelUrl) {
    window.open(shipment.labelUrl, "_blank", "noopener");
    return "Opened the courier label.";
  }
  if (shipment.live && shipment.provider === "shiprocket" && shipment.providerShipmentId) {
    const result = await post<{ labelUrl: string }>({
      action: "label",
      provider: "shiprocket",
      creds: credsFrom(getIntegrations()),
      shipmentId: shipment.providerShipmentId,
    });
    if (result.ok && result.labelUrl) {
      patchShipment(shipmentId, { labelUrl: result.labelUrl });
      window.open(result.labelUrl, "_blank", "noopener");
      return "Opened the Shiprocket label.";
    }
  }
  if (shipment.live && shipment.provider === "ithink" && shipment.awb) {
    const result = await post<{ labelUrl: string }>({
      action: "label",
      provider: "ithink",
      creds: credsFrom(getIntegrations()),
      awb: shipment.awb,
    });
    if (result.ok && result.labelUrl) {
      patchShipment(shipmentId, { labelUrl: result.labelUrl });
      window.open(result.labelUrl, "_blank", "noopener");
      return "Opened the iThink Logistics label.";
    }
  }
  printShippingLabel(shipment);
  return "Printed the AWB label from the site.";
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
  }>({
    action: "return",
    provider,
    creds: credsFrom(settings),
    order: bookingPayload(order, choice, settings),
  });
  if (!result.ok) {
    if (!result.configured) {
      return {
        live: false,
        awb: generateAWB("Return"),
        courierName: "Return pickup (demo)",
        note: `${label(provider)} credentials are not configured, so a demo return AWB was created.`,
      };
    }
    throw new Error(result.error ?? "Could not create the return shipment.");
  }
  return {
    live: true,
    awb: result.awb,
    courierName: result.courierName,
    providerOrderId: result.providerOrderId,
    providerShipmentId: result.providerShipmentId,
    note: `Return booked on ${label(provider)}. AWB ${result.awb}.`,
  };
}

const statusOrder: ShipmentRecord["status"][] = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];

function mapCourierStatus(text: string): ShipmentRecord["status"] | undefined {
  const value = text.toLowerCase();
  if (value.includes("deliver") && !value.includes("out") && !value.includes("un")) return "Delivered";
  if (value.includes("out for")) return "Out for Delivery";
  if (value.includes("transit") || value.includes("shipped") || value.includes("dispatch")) return "In Transit";
  if (value.includes("picked")) return "Picked Up";
  return undefined;
}

export async function trackShipment(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (shipment.live && shipment.provider && shipment.provider !== "local") {
    const result = await post<{
      status: string;
      events: { at: string; status: string; location?: string }[];
      trackingUrl?: string;
    }>({
      action: "track",
      provider: shipment.provider,
      creds: credsFrom(getIntegrations()),
      awb: shipment.awb,
      providerOrderId: shipment.providerOrderId,
    });
    if (!result.ok) throw new Error(result.error ?? "Tracking failed.");
    const mapped = mapCourierStatus(result.status);
    patchShipment(shipmentId, {
      tracking: result.events.length ? result.events : shipment.tracking,
      status: mapped ?? shipment.status,
      trackingUrl: result.trackingUrl || shipment.trackingUrl,
    });
    if (mapped) syncOrderFromShipment(shipment.orderId, mapped);
    return result.status || "No scan yet.";
  }
  return shipment.status;
}

export async function pingLiveAgent(shipmentId: string) {
  const shipment = getShipments().find((item) => item.id === shipmentId);
  if (!shipment) throw new Error("Shipment not found.");
  if (!shipment.live || !shipment.provider || shipment.provider === "local") {
    return {
      status: shipment.status,
      events: shipment.tracking ?? [],
      trackingUrl: publicTrackingUrl(shipment),
    };
  }
  const result = await post<{
    status: string;
    events: { at: string; status: string; location?: string }[];
    lat?: number;
    lng?: number;
    trackingUrl?: string;
  }>({
    action: "track",
    provider: shipment.provider,
    creds: credsFrom(getIntegrations()),
    awb: shipment.awb,
    providerOrderId: shipment.providerOrderId,
  });
  if (!result.ok) throw new Error(result.error ?? "Tracking failed.");
  const mapped = mapCourierStatus(result.status);
  patchShipment(shipmentId, {
    tracking: result.events.length ? result.events : shipment.tracking,
    status: mapped ?? shipment.status,
    trackingUrl: result.trackingUrl || shipment.trackingUrl,
  });
  if (mapped) syncOrderFromShipment(shipment.orderId, mapped);
  return {
    status: result.status || shipment.status,
    events: result.events.length ? result.events : shipment.tracking ?? [],
    lat: result.lat,
    lng: result.lng,
    trackingUrl: result.trackingUrl || publicTrackingUrl(shipment),
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
    status === "Delivered" ? "Delivered" : status === "Out for Delivery" ? "Out for Delivery" : status === "Booked" ? "Packed" : "Shipped";
  if (order.status !== target) patchOrder(orderId, { status: target }, target);
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
