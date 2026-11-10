"use client";

import { quantityCap, setCartQuantity } from "@/lib/store";
import { useCart } from "@/lib/use-cart";

/** − qty + for a product already in the bag. Going below 1 removes it. */
export default function CartStepper({ bookId, size = "sm" }: { bookId: string; size?: "sm" | "lg" }) {
  const { items } = useCart();
  const quantity = items.find((item) => item.bookId === bookId)?.quantity ?? 0;
  if (!quantity) return null;
  const cap = quantityCap(bookId);
  const box = size === "lg" ? "h-11 w-11 text-lg" : "h-7 w-7 text-sm";
  return (
    <div className={`inline-flex items-center rounded-xl border border-emerald-300 bg-emerald-50 ${size === "lg" ? "" : "text-[11px]"}`}>
      <button
        type="button"
        aria-label={quantity === 1 ? "Remove from cart" : "Decrease quantity in cart"}
        onClick={() => setCartQuantity(bookId, quantity - 1)}
        className={`flex ${box} items-center justify-center font-bold text-emerald-900 transition hover:text-burgundy`}
      >
        −
      </button>
      <span className="min-w-12 px-1 text-center font-bold text-emerald-900">{quantity} in cart</span>
      <button
        type="button"
        aria-label="Increase quantity in cart"
        disabled={quantity >= cap}
        onClick={() => setCartQuantity(bookId, quantity + 1)}
        className={`flex ${box} items-center justify-center font-bold text-emerald-900 transition hover:text-burgundy disabled:opacity-40`}
      >
        +
      </button>
    </div>
  );
}
