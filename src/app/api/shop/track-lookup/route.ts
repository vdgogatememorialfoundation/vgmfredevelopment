import { NextRequest, NextResponse } from "next/server";
import { findShopOrder, forCustomer, orderPhoneMatches } from "@/lib/server/shop-orders";
import { listShopShipments } from "@/lib/server/shop-shipments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normal = (value: unknown) => String(value ?? "").replace(/\s+/g, "").toUpperCase();

/** One lookup for every courier: order ID or tracking (AWB) number, verified with the order's mobile number. */
export function GET(request: NextRequest) {
  const ref = normal(request.nextUrl.searchParams.get("ref"));
  const phone = String(request.nextUrl.searchParams.get("phone") ?? "").trim();
  const headers = { "cache-control": "no-store" };
  if (!ref || phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ ok: false, error: "Enter the order ID or tracking number, and the mobile number on the order." }, { status: 400, headers });
  }
  const shipments = listShopShipments();
  const byAwb = shipments.find((shipment) => normal(shipment.awb) === ref);
  const order = findShopOrder(ref) ?? (byAwb ? findShopOrder(byAwb.orderId) : undefined);
  const owned = order && orderPhoneMatches(order, phone) ? order : undefined;
  if (!owned) return NextResponse.json({ ok: false, error: "No order matches that number and mobile number." }, { status: 404, headers });
  const orderShipments = shipments.filter((shipment) => shipment.orderId === owned.id);
  const shipment = byAwb && byAwb.orderId === owned.id ? byAwb : orderShipments[0];
  return NextResponse.json(
    {
      ok: true,
      order: forCustomer(owned),
      shipment: shipment ?? null,
      shipments: orderShipments,
      link: owned.trackToken ? `/track/${owned.trackToken}` : "",
    },
    { headers }
  );
}
