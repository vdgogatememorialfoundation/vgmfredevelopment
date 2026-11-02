"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Book } from "@/types";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { storeConfig } from "@/lib/constants";
import { canOrder } from "@/lib/product-data";
import { addToCart, getEstimatedDeliveryDate } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export default function BookCard({ book }: { book: Book }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const orderable = canOrder(book);
  const delivery = book.expectedDelivery?.trim() || getEstimatedDeliveryDate(storeConfig.orderPreparationDays + storeConfig.defaultDeliveryDays);

  const add = () => {
    if (!orderable) return;
    addToCart(book.id, 1);
    setNote("Added");
  };

  const buyNow = () => {
    if (!orderable) return;
    addToCart(book.id, 1);
    router.push("/checkout");
  };

  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={`/shop/${book.slug}`} className="mx-auto block w-full max-w-36 bg-white">
        <MediaPlaceholder
          variant="book"
          label={book.title}
          src={book.coverImage}
          aspectClassName="aspect-square"
          className="[&_p]:sr-only"
        />
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{book.category}</p>
        <h3 className="mt-1 text-sm font-semibold leading-snug text-text-primary">
          <Link href={`/shop/${book.slug}`} className="line-clamp-2 transition hover:text-burgundy">
            {book.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-text-muted">{book.author}</p>
        <p className="mt-2 text-sm font-bold text-burgundy">{formatCurrency(book.price, book.currency)}</p>
        <p className="text-[11px] text-text-muted">{book.availability}</p>
        <p className="mt-1 text-[11px] font-medium text-ink">Delivery by {delivery}</p>
        {book.storePickupAvailable !== false ? <p className="text-[11px] text-text-muted">Store pickup available</p> : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link href={`/shop/${book.slug}`} className="btn-outline px-2.5 py-1.5 text-[11px]">
            View
          </Link>
          <button type="button" className="btn-outline px-2.5 py-1.5 text-[11px] disabled:opacity-50" disabled={!orderable} onClick={add}>
            {note || "Add to cart"}
          </button>
          <button type="button" className="btn-primary px-2.5 py-1.5 text-[11px] disabled:opacity-50" disabled={!orderable} onClick={buyNow}>
            Buy now
          </button>
        </div>
      </div>
    </article>
  );
}
