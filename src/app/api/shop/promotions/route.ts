import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { publicOrderSettings, type OrderSettings } from "@/lib/integrations";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { checkPromo, newGiftCode, readPromotions, savePromotions, type Coupon, type GiftCard } from "@/lib/server/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!commerceViewer(request).portal) return NextResponse.json({ ok: false, error: "Sign in to the desk." }, { status: 403 });
  const { coupons, giftCards } = readPromotions();
  return NextResponse.json({ ok: true, coupons, giftCards, newCode: newGiftCode() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { action?: string; code?: string; preorder?: boolean; coupons?: Coupon[]; giftCards?: GiftCard[] } | null;
  if (body?.action === "check") {
    const allowed = publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined).promoCodes;
    if (!allowed.coupons && !allowed.giftCards) return NextResponse.json({ ok: false, error: "Coupons and gift cards are not available right now." });
    const result = checkPromo(String(body.code ?? ""), Boolean(body.preorder));
    if (result.ok && !(result.rule.kind === "gift" ? allowed.giftCards : allowed.coupons)) {
      return NextResponse.json({ ok: false, error: result.rule.kind === "gift" ? "Gift cards are not available right now." : "Coupons are not available right now." });
    }
    return NextResponse.json(result);
  }
  if (body?.action === "save") {
    if (!commerceViewer(request).portal) return NextResponse.json({ ok: false, error: "Sign in to the desk." }, { status: 403 });
    const { coupons, giftCards } = savePromotions({ coupons: body.coupons, giftCards: body.giftCards });
    return NextResponse.json({ ok: true, coupons, giftCards });
  }
  if (body?.action === "new-code") return NextResponse.json({ ok: true, code: newGiftCode() });
  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
