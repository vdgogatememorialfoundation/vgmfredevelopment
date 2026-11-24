import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { dataFile } from "@/lib/server/paths";
import { promoDiscount, type PromoRule } from "@/lib/promotions";
import type { Order } from "@/types";

export type Coupon = {
  code: string;
  label: string;
  type: "percent" | "flat";
  value: number;
  minOrder: number;
  maxDiscount: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit: number;
  used: number;
  allowPreorder: boolean;
  active: boolean;
};

export type GiftCard = {
  code: string;
  initial: number;
  balance: number;
  issuedTo?: string;
  note?: string;
  endsAt?: string;
  active: boolean;
  createdAt: string;
  history: { at: string; orderId: string; amount: number }[];
};

type Store = { coupons: Coupon[]; giftCards: GiftCard[]; redeemed: string[] };

const FILE = () => dataFile("promotions.json");

export function readPromotions(): Store {
  try {
    const parsed = JSON.parse(readFileSync(FILE(), "utf8")) as Partial<Store>;
    return { coupons: parsed.coupons ?? [], giftCards: parsed.giftCards ?? [], redeemed: parsed.redeemed ?? [] };
  } catch {
    return { coupons: [], giftCards: [], redeemed: [] };
  }
}

function write(store: Store) {
  const file = FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(store));
}

const clean = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export function newGiftCode() {
  return `GIFT-${randomBytes(6).toString("hex").toUpperCase().match(/.{4}/g)!.join("-")}`;
}

export function savePromotions(input: { coupons?: Coupon[]; giftCards?: GiftCard[] }) {
  const store = readPromotions();
  if (input.coupons) {
    store.coupons = input.coupons
      .map((coupon) => ({ ...coupon, code: clean(coupon.code), value: Math.max(0, Number(coupon.value) || 0), used: Math.max(0, Number(coupon.used) || 0) }))
      .filter((coupon) => coupon.code);
  }
  if (input.giftCards) {
    const before = new Map(store.giftCards.map((card) => [card.code, card]));
    store.giftCards = input.giftCards
      .map((card) => {
        const code = clean(card.code) || newGiftCode();
        const old = before.get(code);
        return { ...card, code, initial: Math.max(0, Number(card.initial) || 0), balance: Math.max(0, Number(card.balance) || 0), history: old?.history ?? card.history ?? [], createdAt: old?.createdAt ?? card.createdAt ?? new Date().toISOString() };
      });
  }
  write(store);
  return store;
}

const live = (startsAt?: string, endsAt?: string, now = Date.now()) =>
  (!startsAt || Date.parse(startsAt) <= now) && (!endsAt || Date.parse(endsAt) >= now);

export function checkPromo(rawCode: string, preorder: boolean): { ok: true; rule: PromoRule } | { ok: false; error: string } {
  const code = clean(rawCode);
  if (!code) return { ok: false, error: "Enter a coupon or gift card code." };
  const store = readPromotions();
  const coupon = store.coupons.find((item) => item.code === code);
  if (coupon) {
    if (!coupon.active || !live(coupon.startsAt, coupon.endsAt)) return { ok: false, error: "This coupon has expired or is not active." };
    if (coupon.usageLimit > 0 && coupon.used >= coupon.usageLimit) return { ok: false, error: "This coupon has been fully used." };
    if (preorder && !coupon.allowPreorder) return { ok: false, error: "This coupon can't be used on pre-orders." };
    return { ok: true, rule: { kind: "coupon", code, label: coupon.label || code, type: coupon.type, value: coupon.value, minOrder: coupon.minOrder || 0, maxDiscount: coupon.maxDiscount || 0 } };
  }
  const card = store.giftCards.find((item) => item.code === code);
  if (card) {
    if (!card.active || !live(undefined, card.endsAt)) return { ok: false, error: "This gift card has expired or is not active." };
    if (card.balance <= 0) return { ok: false, error: "This gift card has no balance left." };
    return { ok: true, rule: { kind: "gift", code, label: "Gift card", balance: card.balance } };
  }
  return { ok: false, error: "That code isn't valid." };
}

/** Uses up the coupon / gift card balance once per order. */
export function redeemPromo(order: Order) {
  const promo = order.promo;
  if (!promo?.code || !promo.amount) return;
  const store = readPromotions();
  if (store.redeemed.includes(order.id)) return;
  const code = clean(promo.code);
  const at = new Date().toISOString();
  const coupon = store.coupons.find((item) => item.code === code);
  const card = store.giftCards.find((item) => item.code === code);
  if (coupon) coupon.used += 1;
  else if (card) {
    const amount = promoDiscount({ kind: "gift", code, label: "", balance: card.balance }, Math.min(promo.amount, order.subtotal));
    card.balance = Math.round((card.balance - amount) * 100) / 100;
    card.history.push({ at, orderId: order.id, amount });
  } else return;
  store.redeemed = [...store.redeemed.slice(-5000), order.id];
  write(store);
}
