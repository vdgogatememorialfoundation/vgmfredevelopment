import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import {
  hideProductReview,
  listReviews,
  removeProductReview,
  removeSeminarReview,
  replyProductReview,
  upsertProductReview,
  upsertSeminarReview,
} from "@/lib/server/reviews";
import type { SeminarReview } from "@/types";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const store = listReviews();
  return NextResponse.json(
    {
      ok: true,
      seminarReviews: store.seminarReviews.filter((item) => item.published !== false),
      productReviews: store.productReviews.filter((item) => !item.hidden),
      allSeminarReviews: store.seminarReviews,
      allProductReviews: store.productReviews,
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body.kind ?? "");
    if (kind === "seminar") {
      const review: SeminarReview = {
        id: String(body.id ?? `seminar-${Date.now()}`),
        name: String(body.name ?? "").trim(),
        event: String(body.event ?? "Seminar").trim() || "Seminar",
        rating: Math.min(5, Math.max(1, Number(body.rating ?? 5))),
        text: String(body.text ?? "").trim(),
        date: String(body.date ?? new Date().toISOString()),
        photo: typeof body.photo === "string" ? body.photo : undefined,
        published: body.published !== false,
      };
      if (!review.name || !review.text) {
        return NextResponse.json({ ok: false, error: "Add the name and review." }, { status: 400 });
      }
      const store = upsertSeminarReview(review);
      return NextResponse.json({ ok: true, review, store });
    }
    if (kind === "product") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const review = {
        id: String(body.id ?? `prev-${Date.now()}`),
        productId: String(body.productId ?? ""),
        name: String(body.name ?? "").trim(),
        email,
        rating: Math.min(5, Math.max(1, Number(body.rating ?? 5))),
        date: String(body.date ?? new Date().toISOString()),
        text: String(body.text ?? "").trim(),
        verified: body.verified !== false,
        hidden: body.hidden === true,
        reply: body.reply && typeof body.reply === "object" ? (body.reply as { text: string; date: string; author?: string }) : undefined,
      };
      if (!review.productId || !review.name || !review.text || !email) {
        return NextResponse.json({ ok: false, error: "Add the product review details." }, { status: 400 });
      }
      const store = upsertProductReview(review);
      return NextResponse.json({ ok: true, review, store });
    }
    return NextResponse.json({ ok: false, error: "Unknown review kind." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing review id." }, { status: 400 });
    if (body.remove === true && body.kind === "seminar") {
      return NextResponse.json({ ok: true, store: removeSeminarReview(id) });
    }
    if (body.remove === true && body.kind === "product") {
      return NextResponse.json({ ok: true, store: removeProductReview(id) });
    }
    if (typeof body.reply === "string") {
      return NextResponse.json({ ok: true, store: replyProductReview(id, body.reply, String(body.author ?? "Foundation")) });
    }
    if (typeof body.hidden === "boolean") {
      return NextResponse.json({ ok: true, store: hideProductReview(id, body.hidden) });
    }
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
