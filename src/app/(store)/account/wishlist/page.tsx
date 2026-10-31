"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";
import { getLiveBook } from "@/lib/product-data";
import { formatPrice, getWishlist, toggleWishlist } from "@/lib/store";

function subscribe(onChange: () => void) {
  window.addEventListener("vgmf-wishlist", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("vgmf-wishlist", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export default function WishlistPage() {
  const snapshot = useCallback(() => JSON.stringify(getWishlist()), []);
  const ids = JSON.parse(useSyncExternalStore(subscribe, snapshot, () => "[]")) as string[];
  const items = ids
    .map((id) => getLiveBook(id))
    .filter((book): book is NonNullable<typeof book> => Boolean(book));

  return (
    <div>
      <SectionHeader
        title="My Wishlist"
        description="Publications you have saved for later."
      />
      {items.length ? (
        <ul className="space-y-3">
          {items.map((book) => (
            <li key={book.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-5">
              <div>
                <Link href={`/shop/${book.slug}`} className="font-semibold text-text-primary transition hover:text-burgundy">
                  {book.title}
                </Link>
                <p className="mt-1 text-sm text-text-muted">
                  {book.author} · {formatPrice(book.price)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/shop/${book.slug}`} className="btn-outline px-3 py-2 text-xs">
                  View
                </Link>
                <button type="button" className="btn-outline px-3 py-2 text-xs" onClick={() => toggleWishlist(book.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Your wishlist is empty"
          description="Browse the shop and save publications you are interested in so you can find them easily later."
          cta={{ label: "Browse the Shop", href: "/shop" }}
        />
      )}
    </div>
  );
}
