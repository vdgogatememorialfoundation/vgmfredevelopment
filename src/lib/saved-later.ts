import { useSyncExternalStore } from "react";
import { addToCart, getCart, removeFromCart } from "@/lib/store";

export const SAVED_LATER_KEY = "vgmf_saved_later";

export type SavedLaterItem = {
  bookId: string;
  quantity: number;
  savedAt: string;
};

type Listener = (items: SavedLaterItem[]) => void;

let current: SavedLaterItem[] = [];
let ready = false;
const listeners = new Set<Listener>();
const EMPTY: SavedLaterItem[] = [];

function read(): SavedLaterItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_LATER_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedLaterItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.bookId && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

function resolve() {
  if (!ready) {
    current = read();
    ready = true;
  }
  return current;
}

function write(items: SavedLaterItem[]) {
  current = items;
  ready = true;
  if (typeof window !== "undefined") window.localStorage.setItem(SAVED_LATER_KEY, JSON.stringify(items));
  for (const listener of listeners) listener(current);
}

export function getSavedLaterSnapshot() {
  return resolve();
}

export function getServerSavedLaterSnapshot() {
  return EMPTY;
}

export function subscribeSavedLater(listener: Listener) {
  resolve();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSavedLater() {
  return useSyncExternalStore(subscribeSavedLater, getSavedLaterSnapshot, getServerSavedLaterSnapshot);
}

export function saveForLater(bookId: string) {
  const item = getCart().find((entry) => entry.bookId === bookId);
  if (!item) return;
  const rest = resolve().filter((entry) => entry.bookId !== bookId);
  write([{ bookId, quantity: item.quantity, savedAt: new Date().toISOString() }, ...rest]);
  removeFromCart(bookId);
}

export function removeSavedLater(bookId: string) {
  write(resolve().filter((entry) => entry.bookId !== bookId));
}

export function moveSavedToCart(bookId: string) {
  const item = resolve().find((entry) => entry.bookId === bookId);
  if (!item) return;
  addToCart(bookId, item.quantity);
  removeSavedLater(bookId);
}
