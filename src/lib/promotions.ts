import type { Book } from "@/types";

/** A coupon or gift card the server accepted at checkout. */
export type PromoRule =
  | { kind: "coupon"; code: string; label: string; type: "percent" | "flat"; value: number; minOrder: number; maxDiscount: number }
  | { kind: "gift"; code: string; label: string; balance: number };

export function offerActive(book: Book, now = Date.now()) {
  const offer = book.offer;
  if (!offer || !(offer.price > 0) || offer.price >= book.price) return false;
  if (offer.startsAt && Date.parse(offer.startsAt) > now) return false;
  if (offer.endsAt && Date.parse(offer.endsAt) < now) return false;
  return true;
}

/** The product as customers see it while its offer runs: offer price, struck-through regular price and the offer label. */
export function withOffer(book: Book): Book {
  if (!offerActive(book) || !book.offer) return book;
  return {
    ...book,
    originalPrice: Math.max(book.originalPrice ?? 0, book.price),
    price: book.offer.price,
    offerLabel: book.offer.label?.trim() || "Special offer",
  };
}

export function promoDiscount(rule: PromoRule, subtotal: number) {
  if (subtotal <= 0) return 0;
  if (rule.kind === "gift") return Math.round(Math.min(rule.balance, subtotal) * 100) / 100;
  if (subtotal < rule.minOrder) return 0;
  const raw = rule.type === "percent" ? (subtotal * rule.value) / 100 : rule.value;
  const capped = rule.type === "percent" && rule.maxDiscount > 0 ? Math.min(raw, rule.maxDiscount) : raw;
  return Math.round(Math.min(capped, subtotal) * 100) / 100;
}

export async function checkPromoCode(code: string, preorder: boolean): Promise<{ ok: true; rule: PromoRule } | { ok: false; error: string }> {
  const response = await fetch("/api/shop/promotions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "check", code, preorder }),
  }).catch(() => null);
  const data = (await response?.json().catch(() => null)) as { ok?: boolean; rule?: PromoRule; error?: string } | null;
  if (data?.ok && data.rule) return { ok: true, rule: data.rule };
  return { ok: false, error: data?.error || "Could not check this code. Try again." };
}
