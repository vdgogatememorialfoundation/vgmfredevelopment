import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { addOrder, bearerToken, listOrders, sessionFromToken } from "@/lib/server/mobile-store";

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

export async function GET(request: NextRequest) {
  const session = sessionOf(request);
  const email = session?.email ?? request.nextUrl.searchParams.get("email") ?? "";
  if (!email) return json({ ok: false, error: "Sign in to view orders." }, 401);
  return json({ ok: true, orders: listOrders(email) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const session = sessionOf(request, body);
  const email = (session?.email || String(body?.email ?? "")).trim().toLowerCase();
  const name = (session?.name || String(body?.name ?? "")).trim() || "Customer";
  const items = Array.isArray(body?.items)
    ? body.items.map((item) => {
        const row = item as { id?: string; title?: string; quantity?: number; price?: number };
        return {
          id: String(row.id ?? ""),
          title: String(row.title ?? "Item"),
          quantity: Math.max(1, Number(row.quantity) || 1),
          price: Number(row.price) || 0,
        };
      })
    : [];
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false, error: "Sign in or enter your email." }, 400);
  if (items.length === 0) return json({ ok: false, error: "Your bag is empty." }, 400);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = addOrder({
    email,
    name,
    phone: body?.phone ? String(body.phone) : undefined,
    items,
    total,
  });
  return json({ ok: true, order });
}
