"use client";

import { useSyncExternalStore } from "react";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  subscribeCart,
} from "@/lib/cart-store";
import { getCartItemCount } from "@/lib/store";

export function useCart() {
  const cart = useSyncExternalStore(
    subscribeCart,
    getCartSnapshot,
    getServerCartSnapshot
  );
  return {
    items: cart,
    count: cart.reduce((sum, item) => sum + item.quantity, 0),
    getCount: () => getCartItemCount(),
  };
}