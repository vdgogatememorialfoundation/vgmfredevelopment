import type { CartItem } from "@/types";

export const CART_STORAGE_KEY = "vgmf_cart";

export type CartListener = (cart: CartItem[]) => void;

let current: CartItem[] = [];
let ready = false;
const listeners = new Set<CartListener>();

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function resolve() {
  if (!ready) {
    current = readCart();
    ready = true;
  }
  return current;
}

export function getCartSnapshot(): CartItem[] {
  return resolve();
}

const EMPTY_CART: CartItem[] = [];

export function getServerCartSnapshot(): CartItem[] {
  return EMPTY_CART;
}

export function subscribeCart(listener: CartListener) {
  resolve();
  listeners.add(listener);
  return function unsubscribe() {
    listeners.delete(listener);
  };
}

export function publishCartChange() {
  current = readCart();
  for (const listener of listeners) listener(current);
}