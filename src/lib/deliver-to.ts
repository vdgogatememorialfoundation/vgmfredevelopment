"use client";

import { useSyncExternalStore } from "react";

const KEY = "vgmf_deliver_to";
const EVENT = "vgmf-deliver-to";

export type DeliverTo = { pincode: string; addressId?: string };

let raw: string | null = null;
let cached: DeliverTo | null = null;

function read(): DeliverTo | null {
  const next = window.localStorage.getItem(KEY);
  if (next === raw) return cached;
  raw = next;
  try {
    const parsed = JSON.parse(next || "null") as DeliverTo | null;
    cached = parsed && /^\d{6}$/.test(parsed.pincode) ? parsed : null;
  } catch {
    cached = null;
  }
  return cached;
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function saveDeliverTo(value: DeliverTo) {
  if (typeof window === "undefined" || !/^\d{6}$/.test(value.pincode)) return;
  const current = read();
  if (current?.pincode === value.pincode && current?.addressId === value.addressId) return;
  window.localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(EVENT));
}

/** The pincode the customer is shopping for, chosen in the header or on a product page. */
export function useDeliverTo() {
  return useSyncExternalStore(subscribe, read, () => null);
}
