"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { dismissAbandonedCart, recoverAbandonedCart, rememberCart } from "@/lib/abandoned-cart";
import { getBookById } from "@/lib/store";
import { useCart } from "@/lib/use-cart";

export default function AbandonedCartNotice() {
  const { user } = useAuth();
  const { items } = useCart();
  const [message, setMessage] = useState("");
  const sawItems = useRef(false);

  useEffect(() => {
    // The first paint can still be the empty server cart. Do not treat that as the customer emptying the cart.
    if (!items.length && !sawItems.current) return;
    sawItems.current = true;
    const titles = items.flatMap((item) => {
      const book = getBookById(item.bookId);
      return book ? [`${book.title} × ${item.quantity}`] : [];
    });
    rememberCart(user?.email || "", items, titles);
  }, [items, user?.email]);

  useEffect(() => {
    const look = () => setMessage(recoverAbandonedCart());
    look();
    const timer = window.setInterval(look, 20000);
    return () => window.clearInterval(timer);
  }, [items, user?.email]);

  if (!message) return null;

  return (
    <div className="border-b border-burgundy/20 bg-warm-cream">
      <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-sm text-ink">{message}</p>
        <div className="flex gap-2">
          <Link href="/cart" className="btn-primary px-4 py-2 text-xs">Return to cart</Link>
          <button type="button" className="btn-outline px-4 py-2 text-xs" onClick={() => { dismissAbandonedCart(); setMessage(""); }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
