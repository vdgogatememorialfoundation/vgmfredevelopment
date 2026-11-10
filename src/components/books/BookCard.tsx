"use client";

import { deliveryCheckText, readDeliveryCheck, type DeliveryCheck } from "@/lib/delivery-check";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Book } from "@/types";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { availabilityText, canOrder, canPreorder, preorderDeliveryDate } from "@/lib/product-data";
import { addToCart } from "@/lib/store";
import { useCart } from "@/lib/use-cart";
import { useSiteSettings } from "@/lib/use-cms";
import CartStepper from "@/components/store/CartStepper";
import { useOrderSettings } from "@/lib/use-cms";
import { formatCurrency } from "@/lib/utils";

export default function BookCard({ book }: { book: Book }) {
  const router = useRouter();
  const inCart = useCart().items.some((item) => item.bookId === book.id);
  const sizes = useSiteSettings()?.productText;
  const orderable = canOrder(book);
  const [checked, setChecked] = useState<DeliveryCheck | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setChecked(readDeliveryCheck()));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  // Same courier date the product page found for the shopper's pincode; no guessed date otherwise.
  const preorder = canPreorder(book);
  const delivery = preorder
    ? preorderDeliveryDate(book)
    : book.expectedDelivery?.trim() || (checked ? `${deliveryCheckText(checked)} to ${checked.pincode}` : "");

  const hideDates = useOrderSettings().hideDeliveryDates;

  const add = () => {
    if (!orderable) return;
    addToCart(book.id, 1);
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
        <h3 className="mt-1 text-sm font-semibold leading-snug text-text-primary" style={sizes?.cardTitle ? { fontSize: sizes.cardTitle } : undefined}>
          <Link href={`/shop/${book.slug}`} className="line-clamp-2 transition hover:text-burgundy">
            {book.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-text-muted" style={sizes?.cardMeta ? { fontSize: sizes.cardMeta } : undefined}>
          {book.author}
        </p>
        {book.language ? (
          <p className="mt-1 font-extrabold leading-tight text-burgundy" style={{ fontSize: sizes?.cardLanguage || 15 }}>
            {book.language}
          </p>
        ) : null}
        <p className="mt-2 text-sm font-bold text-burgundy" style={sizes?.cardPrice ? { fontSize: sizes.cardPrice } : undefined}>{formatCurrency(book.price, book.currency)}</p>
        <AvailabilityBadge text={availabilityText(book)} />
        {hideDates ? null : (
          <p className="mt-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-sm font-bold leading-snug text-emerald-800">
            {delivery ? `${preorder ? "Tentative delivery by" : "Delivery by"} ${delivery}` : "Check delivery date for your pincode"}
          </p>
        )}
        {book.storePickupAvailable !== false ? (
          <p className="mt-1 rounded-lg bg-sky-50 px-2 py-1 text-sm font-bold text-sky-800">Store pickup available</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link href={`/shop/${book.slug}`} className="btn-outline px-2.5 py-1.5 text-[11px]">
            View
          </Link>
          {inCart ? (
            <CartStepper bookId={book.id} />
          ) : (
            <button type="button" className="btn-outline px-2.5 py-1.5 text-[11px] disabled:opacity-50" disabled={!orderable} onClick={add}>
              Add to cart
            </button>
          )}
          <button type="button" className="btn-primary px-2.5 py-1.5 text-[11px] disabled:opacity-50" disabled={!orderable} onClick={buyNow}>
            Buy now
          </button>
        </div>
      </div>
    </article>
  );
}

function AvailabilityBadge({ text }: { text: string }) {
  const tone =
    text === "Pre-order"
      ? "bg-amber-100 text-amber-900 ring-amber-300"
      : text === "In Stock"
        ? "bg-emerald-100 text-emerald-900 ring-emerald-300"
        : "bg-red-50 text-red-800 ring-red-200";
  return <p className={`mt-1.5 inline-flex w-fit rounded-full px-2.5 py-0.5 text-sm font-bold ring-1 ${tone}`}>{text}</p>;
}
