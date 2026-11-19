import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { viewerEmail } from "@/lib/server/form-viewer";
import { feedbackFor, saveOrderFeedback } from "@/lib/server/forms";
import { findShopOrder, ordersForAccount } from "@/lib/server/shop-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { ...corsHeaders, "cache-control": "no-store" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function access(request: NextRequest, orderId: string) {
  const viewer = viewerEmail(request);
  const order = findShopOrder(orderId);
  if (!order) return { order: null, viewer, owner: false };
  const owner = Boolean(viewer.email) && ordersForAccount({ email: viewer.email }).some((row) => row.id === order.id);
  return { order, viewer, owner };
}

/** Delivery experience and product ratings belong to the order: only its customer and the desk see them. */
export function GET(request: NextRequest) {
  const { order, viewer, owner } = access(request, request.nextUrl.searchParams.get("order") ?? "");
  if (!order || (!owner && !viewer.portal)) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404, headers });
  return NextResponse.json(
    {
      ok: true,
      feedback: feedbackFor(order.id),
      canRate: owner && order.status === "Delivered",
      pickup: order.deliveryMode === "store_pickup",
      items: order.items.map((item) => ({ bookId: item.bookId, title: item.title })),
    },
    { headers }
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { order?: string; delivery?: { rating?: unknown; comment?: unknown }; products?: { bookId?: unknown; rating?: unknown; comment?: unknown }[] };
  const { order, viewer, owner } = access(request, String(body.order ?? ""));
  if (!order || !owner) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404, headers });
  try {
    return NextResponse.json({ ok: true, feedback: saveOrderFeedback(order, viewer.email, body) }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400, headers });
  }
}
