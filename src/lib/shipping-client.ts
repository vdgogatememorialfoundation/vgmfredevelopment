import type { CourierRate, Order, ShipmentRecord } from "@/types";
import { checkPincode } from "@/lib/fulfillment";
import { getIntegrations, type IntegrationSettings } from "@/lib/integrations";
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
  const { shiprocket, nimbuspost, shipyaari, tookan, shipday } = settings.shipping;
  return { shiprocket, nimbuspost, shipyaari, tookan, shipday };
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
  const wanted = (["shiprocket", "nimbuspost", "shipyaari"] as const).filter((id) => shipping[id].enabled);
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
        else if (!provider.configured && provider.provider === "shipyaari" && shipping.shipyaari.apiKey) notes.push("Shipyaari: live rates are not connected yet.");
      }
    } catch {
      notes.push("Courier rate service could not be reached.");
    }
  }
  if (live.length) return { rates: live, live: true, notes };

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

/**
 * Books the courier for an order. With live aggregator credentials the
 * aggregator charges its wallet for the AWB; the ledger keeps what the
 * customer paid next to what the courier cost.
 */
export async function bookShipment(orderId: string, override?: CourierRate): Promise<BookingResult> {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.deliveryMode !== "delivery") throw new Error("Store pickup orders do not need a courier.");
  const existing = getShipments().find((shipment) => shipment.orderId === order.id);
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

  const base: ShipmentRecord = {
    id: `SHP${Date.now()}`,
    orderId: order.id,
    sellerId: order.sellerId,
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
      pickupScheduledFor?: string;
      pickupReference?: string;
      courierCost?: number;
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
        pickupScheduledFor: result.pickupScheduledFor || undefined,
        pickupReference: result.pickupReference || undefined,
        courierCost: result.courierCost ?? choice.rate,
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
      status: order.status === "Ordered" || order.status === "Pending" || order.status === "Processing" ? "Packed" : order.status,
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
  printShippingLabel(shipment);
  return "Printed the AWB label from the site.";
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
  if (shipment.live && (shipment.provider === "shiprocket" || shipment.provider === "nimbuspost")) {
    const result = await post<{ status: string; events: { at: string; status: string; location?: string }[] }>({
      action: "track",
      provider: shipment.provider,
      creds: credsFrom(getIntegrations()),
      awb: shipment.awb,
    });
    if (!result.ok) throw new Error(result.error ?? "Tracking failed.");
    const mapped = mapCourierStatus(result.status);
    patchShipment(shipmentId, { tracking: result.events.length ? result.events : shipment.tracking, status: mapped ?? shipment.status });
    if (mapped) syncOrderFromShipment(shipment.orderId, mapped);
    return result.status || "No scan yet.";
  }
  return shipment.status;
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
  if (shipment.live && (shipment.provider === "shiprocket" || shipment.provider === "nimbuspost")) {
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
  return post<{ message?: string }>({ action: "test", provider, creds: credsFrom(getIntegrations()) });
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
