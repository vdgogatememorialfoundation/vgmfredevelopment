import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";
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
      quantity: Math.max(1, Math.min(20, Math.floor(Number(row.quantity) || 1))),
      price: Math.max(0, Number(book.price) || 0),
    });
  }
  return { items };
}

export async function GET(request: NextRequest) {
  const session = sessionOf(request);
  if (!session) return json({ ok: false, error: "Sign in to view orders." }, 401);
  return json({ ok: true, store: "mobile-api", orders: listOrders(session.email) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const session = sessionOf(request, body);
  if (!session) return json({ ok: false, error: "Sign in to record a publication request." }, 401);
  const email = session.email;
  const name = (String(body?.name ?? "").trim() || session.name || "Customer").slice(0, 80);
  const catalog = catalogItems(body?.items);
  if ("error" in catalog) return json({ ok: false, error: catalog.error }, 400);
  const order = addOrder({
    email,
    name,
    phone: body?.phone ? String(body.phone) : undefined,
    items: catalog.items,
  });
  return json({
    ok: true,
    store: "mobile-api",
    order,
    paymentStatus: "unpaid",
    note: "This records an unpaid publication request on the mobile API. It is not a website checkout order and is not marked paid. Card payment stays on the website.",
  });
}
