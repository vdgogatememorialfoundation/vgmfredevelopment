import { NextRequest, NextResponse } from "next/server";
import { commerceViewer, customerViewer } from "@/lib/server/commerce-viewer";
import { addWalletEntries, walletFor, walletIdFor, walletIdMatches, type WalletEntry } from "@/lib/server/shop-wallet";
import { bearerToken, sessionFromToken } from "@/lib/server/mobile-store";
import { sendMobileEmail } from "@/lib/server/mobile-mail";

const resent = new Map<string, number>();

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
  const staffLookup = Boolean(viewer.portal && asked);
  // Staff never see the ID; the counter can only check the code the customer gives.
  const code = request.nextUrl.searchParams.get("walletId") || "";
  const extra = staffLookup ? (code ? { idMatches: walletIdMatches(email, code) } : {}) : { walletId: walletIdFor(email) };
  return NextResponse.json({ ok: true, ...walletFor(email), ...extra }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.email) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { entries?: WalletEntry[]; resendId?: boolean; email?: string } | null;
  if (body?.resendId) {
    const own = customerViewer(request)?.email || viewer.email;
    const email = (viewer.portal && body.email ? body.email : own).trim().toLowerCase();
    const wallet = walletFor(email);
    if (!(wallet.balance > 0)) return NextResponse.json({ ok: false, error: "No unexpired store credit on this account." }, { status: 400 });
    const last = resent.get(email) ?? 0;
    if (Date.now() - last < 120_000) return NextResponse.json({ ok: false, error: "The ID was just sent. Try again in 2 minutes." }, { status: 429 });
    resent.set(email, Date.now());
    await sendMobileEmail(
      email,
      "Your VGMF Store Credit ID",
      `Your Store Credit ID is ${walletIdFor(email)}.\n\nGive this ID at the counter to use your store credit (balance ₹${wallet.balance}). Store credit can be used only until it expires.\n\nVaidya Gogate Memorial Foundation`
    );
    return NextResponse.json({ ok: true, sentTo: email.replace(/^(.).*(@.*)$/, "$1•••$2") });
  }
  const added = addWalletEntries(Array.isArray(body?.entries) ? body.entries : [], viewer);
  return NextResponse.json({ ok: true, added });
}
