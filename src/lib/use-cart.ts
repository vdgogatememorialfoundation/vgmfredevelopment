"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  subscribeCart,
} from "@/lib/cart-store";
import { getCartItemCount, quantityCap, setCartQuantity } from "@/lib/store";
import { useLiveBooks } from "@/lib/use-cms";

export function useCart() {
  const cart = useSyncExternalStore(
    subscribeCart,
    getCartSnapshot,
    getServerCartSnapshot
  );
  const catalogue = useLiveBooks();

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