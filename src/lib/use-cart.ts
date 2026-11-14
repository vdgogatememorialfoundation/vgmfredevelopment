"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  subscribeCart,
} from "@/lib/cart-store";
import { getCartItemCount, quantityCap, setCartQuantity } from "@/lib/store";
import { useLiveBooks } from "@/lib/use-cms";
import { getSession } from "@/lib/auth";

let cartSynced = false;

export function useCart() {
  const cart = useSyncExternalStore(
    subscribeCart,
    getCartSnapshot,
    getServerCartSnapshot
  );
  const catalogue = useLiveBooks();

  useEffect(() => {
    let timer = 0;
    const push = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void import("@/lib/commerce-sync").then((mod) => mod.syncCart()), 800);
    };
    if (!cartSynced) {
      cartSynced = true;
      push();
    }
    let email = getSession()?.email ?? "";
    const onSession = () => {
      const next = getSession()?.email ?? "";
      if (next === email) return;
      email = next;
      push();
    };
    window.addEventListener("vgmf-cart-edit", push);
    window.addEventListener("vgmf-cms", onSession);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("vgmf-cart-edit", push);
      window.removeEventListener("vgmf-cms", onSession);
    };
  }, []);

  useEffect(() => {
    for (const item of cart) {
      const known = catalogue.some((book) => book.id === item.bookId);
      if (!known) continue;
      const cap = quantityCap(item.bookId);
      if (item.quantity > cap) setCartQuantity(item.bookId, cap);
    }
  }, [cart, catalogue]);

  return {
    items: cart,
    count: cart.reduce((sum, item) => sum + item.quantity, 0),
    getCount: () => getCartItemCount(),
  };
}