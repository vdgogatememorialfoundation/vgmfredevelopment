import { NextRequest, NextResponse } from "next/server";
import { commerceViewer, customerViewer } from "@/lib/server/commerce-viewer";
import { addWalletEntries, walletFor, type WalletEntry } from "@/lib/server/shop-wallet";
import { bearerToken, sessionFromToken } from "@/lib/server/mobile-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = commerceViewer(request);
  const asked = request.nextUrl.searchParams.get("email")?.toLowerCase() || "";
  const app = viewer.email ? null : sessionFromToken(bearerToken(request.headers.get("authorization")));
  // A staff sign-in in the same browser must not replace the customer's own wallet.
  const own = customerViewer(request)?.email || viewer.email;
  const email = viewer.portal && asked ? asked : own || app?.email?.toLowerCase() || "";
  if (!email) return NextResponse.json({ ok: true, balance: 0, entries: [] }, { headers: { "cache-control": "no-store" } });
  return NextResponse.json({ ok: true, ...walletFor(email) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.email) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { entries?: WalletEntry[] } | null;
  const added = addWalletEntries(Array.isArray(body?.entries) ? body.entries : [], viewer);
  return NextResponse.json({ ok: true, added });
}
