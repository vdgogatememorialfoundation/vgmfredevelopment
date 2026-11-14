import { NextResponse } from "next/server";
import { findShopOrderByToken, forCustomer } from "@/lib/server/shop-orders";
import { findShopShipment } from "@/lib/server/shop-shipments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Params) {
  const { token } = await context.params;
  const order = findShopOrderByToken(token);
  if (!order) return NextResponse.json({ ok: false, error: "This tracking link is not valid." }, { status: 404 });
  const shipment = findShopShipment(order.id);
  return NextResponse.json({ ok: true, order: forCustomer(order), shipment: shipment?.note === "Cancelled" ? null : shipment ?? null }, { headers: { "cache-control": "no-store" } });
}
