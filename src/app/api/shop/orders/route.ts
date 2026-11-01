import { NextRequest, NextResponse } from "next/server";
import { searchShopOrders, upsertShopOrder } from "@/lib/server/shop-orders";
import type { Order } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ ok: true, orders: searchShopOrders(q) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { order?: Order } | null;
  const order = body?.order;
  if (!order || typeof order.id !== "string" || !Array.isArray(order.items)) {
    return NextResponse.json({ ok: false, error: "Send the order." }, { status: 400 });
  }
  upsertShopOrder(order);
  return NextResponse.json({ ok: true });
}
