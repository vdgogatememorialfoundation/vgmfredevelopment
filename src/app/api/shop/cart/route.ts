import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { readCart, saveCart } from "@/lib/server/shop-cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.email || viewer.portal) {
    return NextResponse.json({ ok: true, items: [], at: 0 }, { headers: { "cache-control": "no-store" } });
  }
  const row = readCart(viewer.email);
  return NextResponse.json({ ok: true, items: row?.items ?? [], at: row?.at ?? 0 }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.email || viewer.portal) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { items?: unknown; at?: unknown } | null;
  const items = Array.isArray(body?.items) ? (body.items as { bookId: string; quantity: number }[]) : [];
  const at = Number(body?.at) || 0;
  if (!at) return NextResponse.json({ ok: false, error: "Send the cart." }, { status: 400 });
  saveCart(viewer.email, items, at);
  return NextResponse.json({ ok: true });
}
