import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";
import { isValidPhone, isValidPostal } from "@/lib/geo";
import { countryRejection } from "@/lib/server/platform-countries";
import { appOrdersFor } from "@/lib/server/mobile-shop";
import { listShopShipments } from "@/lib/server/shop-shipments";
import { forCustomer } from "@/lib/server/shop-orders";
import { addOrder, bearerToken, listOrders, requestMobileReplacement, sessionFromToken } from "@/lib/server/mobile-store";
import { buildTrackingStages, shipmentScans } from "@/lib/order-pipeline";
import { agreedDelivery, deliveryDatePhrase, statusStamp } from "@/lib/delivery-expectation";
import { customerCourierLabel } from "@/lib/courier-label";
import type { Order, ShipmentRecord } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

function sessionOf(request: NextRequest, body?: Record<string, unknown> | null) {
  return sessionFromToken(bearerToken(request.headers.get("authorization")) ?? String(body?.token ?? ""));
}

function catalogItems(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Your bag is empty." as const };
  const books = readMobileFeed().books ?? [];
  const items: { id: string; title: string; quantity: number; price: number }[] = [];
  for (const entry of raw) {
    const row = entry as { id?: string; quantity?: number };
    const id = String(row.id ?? "").trim();
    const book = books.find((item) => String(item.id) === id || String(item.slug) === id);
    if (!book || book.active === false) return { error: "A publication in your bag is not in the published catalogue." as const };
    if (book.stockStatus === "out_of_stock") return { error: `${book.title} is currently out of stock.` as const };
    items.push({
      id: String(book.id),
      title: String(book.title),
      quantity: Math.max(1, Math.min(100, Math.floor(Number(row.quantity) || 1))),
      price: Math.max(0, Number(book.price) || 0),
    });
  }
  return { items };
}

/** The website's order tracker (same stages, scans and expected date), ready for the app to draw. */
function trackingFor(order: Order, shipment?: ShipmentRecord) {
  try {
    const { stages } = buildTrackingStages(order, shipmentScans(shipment), shipment);
    const country = order.deliveryAddress?.country;
    const partial = stages.map((stage) => stage.partial).lastIndexOf(true);
    const current = partial !== -1 ? partial : stages.map((stage) => stage.reached).lastIndexOf(true);
    const expected = agreedDelivery(order.eta, shipment?.expectedBy, Date.parse(order.date) || Date.now());
    return {
      shipmentId: shipment?.id ?? "",
      part: shipment?.part ?? 0,
      courier: customerCourierLabel({ provider: shipment?.provider ?? order.courierChoice?.provider, courier: shipment?.courier || order.courierName }),
      trackingId: shipment?.awb || order.trackingId || "",
      expected: expected ? deliveryDatePhrase(expected) : "",
      current: Math.max(0, current),
      stages: stages.map((stage) => ({
        id: stage.id,
        label: stage.label,
        caption: stage.caption ?? "",
        reached: stage.reached,
        partial: stage.partial,
        events: stage.events.map((event) => ({
          title: event.title,
          when: event.at ? statusStamp(event.at, country) : "",
          location: event.location ?? "",
          detail: event.detail ?? "",
        })),
      })),
    };
  } catch {
    return null;
  }
}

function trackersFor(order: Order, shipments: ShipmentRecord[]) {
  const parts = shipments.filter((item) => item.part).sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
  const list = parts.length >= 2 ? parts : [shipments[0]];
  return list.map((shipment) => trackingFor(order, shipment)).filter(Boolean);
}

export async function GET(request: NextRequest) {
  const session = sessionOf(request);
  if (!session) return json({ ok: false, error: "Sign in to view orders." }, 401);
  const shipments = listShopShipments().filter((item) => item.note !== "Cancelled");
  const shop = appOrdersFor(session.email).map((order) => {
    const own = shipments.filter((item) => item.orderId === order.id);
    return { ...forCustomer(order as Order), shipments: own, tracking: trackersFor(order as Order, own as ShipmentRecord[]) };
  });
  const ids = new Set(shop.map((order) => order.id));
  const legacy = listOrders(session.email).filter((order) => !ids.has(order.id));
  return json({ ok: true, store: "shop", orders: shop, legacy });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const session = sessionOf(request, body);
  if (!session) return json({ ok: false, error: "Sign in to record a publication request." }, 401);
  if (String(body?.action ?? "") === "replacement") {
    const images = Array.isArray(body?.images) ? body.images.map((item) => String(item)).filter(Boolean).slice(0, 6) : [];
    try {
      const order = requestMobileReplacement(String(body?.orderId ?? ""), session.email, {
        note: String(body?.note ?? ""),
        images,
      });
      if (!order) return json({ ok: false, error: "Order not found." }, 404);
      return json({ ok: true, order });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "Could not send the request." }, 400);
    }
  }
  const email = session.email;
  const name = (String(body?.name ?? "").trim() || session.name || "Customer").slice(0, 80);
  const catalog = catalogItems(body?.items);
  if ("error" in catalog) return json({ ok: false, error: catalog.error }, 400);
  const countryCode = String(body?.countryCode ?? body?.country ?? "IN").trim().slice(0, 8);
  const address = {
    line1: String(body?.line1 ?? "").trim().slice(0, 160),
    city: String(body?.city ?? "").trim().slice(0, 80),
    state: String(body?.state ?? "").trim().slice(0, 80),
    pincode: String(body?.pincode ?? "").trim().slice(0, 12),
    country: String(body?.country ?? "").trim().slice(0, 80),
    countryCode,
  };
  const countryBlocked = countryRejection(countryCode, address.country);
  if (countryBlocked) return json({ ok: false, error: countryBlocked }, 400);
  if (!address.line1 || !address.city || !address.state || !isValidPostal(countryCode, address.pincode)) {
    return json({ ok: false, error: "Enter your full delivery address and a valid postal code." }, 400);
  }
  const phone = String(body?.phone ?? "").trim();
  if (!isValidPhone(phone)) {
    return json({ ok: false, error: "Enter a valid international phone number, including the country code." }, 400);
  }
  const order = addOrder({
    email,
    name,
    phone,
    items: catalog.items,
    address,
  });
  return json({
    ok: true,
    store: "mobile-api",
    order,
    paymentStatus: order.paymentStatus,
  });
}
