import type { CartItem } from "@/types";
import { pushInbox } from "@/lib/inbox";
import { queueNotification } from "@/lib/notify";

const KEY = "vgmf_abandoned_cart";
export const ABANDONED_CART_IDLE_MS = 30 * 60 * 1000;

export type AbandonedCart = {
  email: string;
  items: CartItem[];
  titles: string[];
  touchedAt: string;
  remindedAt?: string;
  dismissedAt?: string;
};

function read(): AbandonedCart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AbandonedCart;
    return parsed?.items?.length ? parsed : null;
  } catch {
    return null;
  }
}

function write(record: AbandonedCart | null) {
  if (typeof window === "undefined") return;
  if (!record) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, JSON.stringify(record));
}

function sameItems(left: CartItem[], right: CartItem[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item.bookId === right[index]?.bookId && item.quantity === right[index]?.quantity);
}

export function rememberCart(email: string, items: CartItem[], titles: string[]) {
  if (!items.length) {
    write(null);
    return;
  }
  const prev = read();
  const emailSame = !prev?.email || !email || prev.email === email;
  const same = Boolean(prev && sameItems(prev.items, items) && emailSame);
  write({
    email: email || (same && prev ? prev.email : ""),
    items,
    titles: titles.length ? titles : same && prev ? prev.titles : titles,
    touchedAt: same && prev ? prev.touchedAt : new Date().toISOString(),
    remindedAt: same ? prev?.remindedAt : undefined,
    dismissedAt: same ? prev?.dismissedAt : undefined,
  });
}

export function markCartRecovered() {
  write(null);
}

export function dismissAbandonedCart() {
  const current = read();
  if (!current) return;
  write({ ...current, dismissedAt: new Date().toISOString(), remindedAt: current.remindedAt || new Date().toISOString() });
}

/** Sends one recovery note after the cart has been idle, and returns the banner text. */
export function recoverAbandonedCart(now = Date.now()) {
  const current = read();
  if (!current || current.dismissedAt || !current.items.length) return "";
  if (now - Date.parse(current.touchedAt) < ABANDONED_CART_IDLE_MS) return "";
  const units = current.items.reduce((sum, item) => sum + item.quantity, 0);
  const message = `You left ${units} book${units === 1 ? "" : "s"} in your cart. They are still saved here.`;
  if (!current.remindedAt) {
    const list = current.titles.join(", ");
    if (current.email) {
      queueNotification({
        to: current.email,
        subject: "You left items in your Foundation shop cart",
        template: "abandoned-cart",
        name: "Reader",
        body: `Dear Reader,\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nYou left these items in your cart: ${list}.\n\nOpen the cart and complete the order when you are ready.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
      });
      pushInbox({
        audience: "customer",
        email: current.email,
        kind: "order",
        title: "Your cart is still waiting",
        body: list || message,
        href: "/cart",
      });
    }
    pushInbox({
      audience: "staff",
      kind: "order",
      title: "Abandoned cart",
      body: `${current.email || "Guest"} · ${list || `${units} books`}`,
      href: "/admin/commerce/orders",
    });
    write({ ...current, remindedAt: new Date(now).toISOString() });
  }
  return message;
}
