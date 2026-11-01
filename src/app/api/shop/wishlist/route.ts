import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { readWishlist, saveWishlist } from "@/lib/server/shop-wishlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.email || viewer.portal) {
    return NextResponse.json({ ok: true, ids: [], at: 0 }, { headers: { "cache-control": "no-store" } });
  }
  const row = readWishlist(viewer.email);
  return NextResponse.json(
    { ok: true, ids: row?.ids ?? [], at: row?.at ?? 0 },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.email || viewer.portal) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { ids?: unknown; at?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  const at = Number(body?.at) || 0;
  if (!at) return NextResponse.json({ ok: false, error: "Send the wishlist." }, { status: 400 });
  saveWishlist(viewer.email, ids, at);
  return NextResponse.json({ ok: true });
}
