"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { useCart } from "@/lib/use-cart";
import { deliveryCheckText, readDeliveryCheck, type DeliveryCheck } from "@/lib/delivery-check";
import { shippingIsFree } from "@/lib/integrations";
import {
  getBookById,
  setCartQuantity,
  removeFromCart,
  quantityCap,
  toggleWishlist,
  computeTotals,
  formatPrice,
  getEstimatedDeliveryDate,
} from "@/lib/store";
import { isPurchasable } from "@/lib/product-data";
import QtyControl from "@/components/store/QtyControl";
import RestockAlert from "@/components/store/RestockAlert";
import { moveSavedToCart, removeSavedLater, saveForLater, useSavedLater } from "@/lib/saved-later";
import { storeConfig } from "@/lib/constants";
import { useLiveBooks, useOrderSettings } from "@/lib/use-cms";
import Glyph from "@/components/store/Glyph";

export default function CartPage() {
  const [deliveryCheck, setDeliveryCheck] = useState<DeliveryCheck | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDeliveryCheck(readDeliveryCheck()));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const { items, count } = useCart();
  const saved = useSavedLater();
  const catalogue = useLiveBooks();

  const bookFor = (bookId: string) => catalogue.find((book) => book.id === bookId) ?? getBookById(bookId);

  const rows = items.flatMap((item) => {
    const book = bookFor(item.bookId);
    return book ? [{ item, book }] : [];
  });

  const totals = computeTotals(
    rows.map((row) => ({
      price: row.book.price,
      originalPrice: row.book.originalPrice,
      quantity: row.item.quantity,
    }))
  );

  const orderSettings = useOrderSettings();
  const shippingFree = orderSettings.shippingFeeMode !== "free_above" || totals.subtotal >= orderSettings.freeAbove;

  return (
    <main>
      <PageHeader
        eyebrow="Store"
        title={count > 0 ? `Shopping Cart (${count})` : "Shopping Cart"}
      />

      <section className="section bg-background">
        <div className="container grid max-w-6xl gap-10 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-cream text-burgundy">
                  <Glyph name="package" className="h-7 w-7" />
                </div>
                <h2 className="mt-4 font-semibold text-text-primary">
                  Your cart is empty
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
                  Browse the Foundation shop and add books to your cart.
                  Applied discounts and delivery estimates will appear here.
                </p>
                <Link href="/shop" className="btn-primary mt-6">
                  Continue Shopping
                </Link>
              </div>
            ) : (
              rows.map(({ item, book }) => (
                <article
                  key={item.bookId}
                  className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
                >
                  <Link
                    href={`/shop/${book.slug}`}
                    className="shrink-0"
                  >
                    <MediumBookCover book={book} />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/shop/${book.slug}`}
                      className="font-semibold text-text-primary transition hover:text-burgundy"
                    >
                      {book.title}
                    </Link>
                    <p className="mt-1 text-xs text-text-muted">
                      Published by {book.publisher?.name ?? storeConfig.publisherName} ·{" "}
                      {book.sku ? `SKU: ${book.sku}` : book.author}
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <span className="font-bold text-text-primary">
                        {formatPrice(book.price * item.quantity)}
                      </span>
                      <span className="text-xs text-text-muted">Qty {item.quantity} · {formatPrice(book.price)} each</span>
                      {book.originalPrice && book.originalPrice > book.price && (
                        <span className="text-sm text-text-muted line-through">
                          {formatPrice(book.originalPrice * item.quantity)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                      <Glyph name="truck" className="h-3.5 w-3.5" />
                      {deliveryCheck ? `Delivery by ${deliveryCheckText(deliveryCheck)} to ${deliveryCheck.pincode}` : "Delivery date for your pincode is shown at checkout"}
                      {book.expectedDelivery ? ` · ${book.expectedDelivery}` : ""}
                    </p>

                    {!isPurchasable(book) && <p className="mt-2 text-xs font-semibold text-burgundy">Out of stock</p>}
                    {!isPurchasable(book) && <RestockAlert bookId={book.id} />}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <QtyControl value={item.quantity} max={quantityCap(book.id)} onChange={(quantity) => setCartQuantity(item.bookId, quantity)} />
                      <button
                        type="button"
                        onClick={() => saveForLater(item.bookId)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted transition hover:text-burgundy"
                      >
                        Save for later
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          toggleWishlist(item.bookId);
                          removeFromCart(item.bookId);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted transition hover:text-burgundy"
                      >
                        <Glyph name="heart" className="h-3.5 w-3.5" />
                        Move to Wishlist
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.bookId)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 transition hover:text-red-700"
                      >
                        <Glyph name="trash" className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}

            {saved.length > 0 && (
              <div className="rounded-2xl border border-border bg-white p-5">
                <h2 className="font-semibold text-text-primary">Saved for later ({saved.length})</h2>
                <ul className="mt-4 space-y-4">
                  {saved.map((item) => {
                    const book = bookFor(item.bookId);
                    if (!book) return null;
                    return (
                      <li key={item.bookId} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
                        <div>
                          <Link href={`/shop/${book.slug}`} className="font-semibold text-text-primary hover:text-burgundy">{book.title}</Link>
                          <p className="mt-1 text-xs text-text-muted">Qty {item.quantity} · {formatPrice(book.price)}</p>
                          {!isPurchasable(book) && <RestockAlert bookId={book.id} />}
                        </div>
                        <div className="flex gap-3 text-xs font-semibold">
                          <button type="button" className="text-burgundy" onClick={() => moveSavedToCart(item.bookId)}>Move to cart</button>
                          <button type="button" className="text-red-600" onClick={() => removeSavedLater(item.bookId)}>Remove</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-white p-5 text-xs text-text-muted">
              <p className="font-semibold text-text-primary">
                Replacements
              </p>
              <p className="mt-1">
                Orders cannot be cancelled or returned from your account. Damaged items can be replaced after delivery if you share photos for the Foundation desk to review.
              </p>
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="heading-3 flex items-center gap-2">
                <Glyph name="tag" className="h-5 w-5 text-burgundy" />
                Price Details
              </h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-muted">MRP</dt>
                  <dd className="font-medium text-text-primary">
                    {formatPrice(totals.mrp)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Discount</dt>
                  <dd className="font-medium text-emerald-700">
                    − {formatPrice(totals.discount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Books</dt>
                  <dd className="font-medium text-text-primary">{count}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Subtotal</dt>
                  <dd className="font-medium text-text-primary">
                    {formatPrice(totals.subtotal)}
                  </dd>
                </div>
                {orderSettings.gst.enabled && (
                  <div className="flex justify-between">
                    <dt className="text-text-muted">GST ({orderSettings.gst.ratePercent}%)</dt>
                    <dd className="font-medium text-text-primary">{formatPrice(totals.gst)}</dd>
                  </div>
                )}
                {orderSettings.platformFee.enabled && (
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Platform fee{orderSettings.platformFee.refundable ? "" : " (kept on refund)"}</dt>
                    <dd className="font-medium text-text-primary">{formatPrice(totals.platformFee)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-text-muted">Shipping</dt>
                  <dd className="font-medium text-text-primary">
                    {totals.shipping > 0
                      ? formatPrice(totals.shipping)
                      : shippingIsFree(totals.subtotal, orderSettings)
                        ? "FREE"
                        : "Calculated at checkout"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <dt className="font-semibold text-text-primary">
                    Total Amount
                  </dt>
                  <dd className="font-bold text-burgundy">
                    {formatPrice(totals.total)}
                  </dd>
                </div>
              </dl>

              {!shippingFree && totals.subtotal > 0 && orderSettings.freeAbove > 0 && (
                <div className="mt-4 rounded-xl bg-warm-cream p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1 font-semibold text-ink"><Glyph name="truck" className="h-3.5 w-3.5 text-burgundy" /> Free shipping</span>
                    <span>{formatPrice(orderSettings.freeAbove - totals.subtotal)} to go</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white">
                    <span className="block h-full bg-burgundy" style={{ width: `${Math.min(100, Math.round((totals.subtotal / orderSettings.freeAbove) * 100))}%` }} />
                  </div>
                </div>
              )}
              <ul className="mt-4 space-y-2 text-xs text-text-muted">
                <li className="flex items-center gap-2"><Glyph name="lock" className="h-3.5 w-3.5 text-burgundy" /> Secure payment</li>
                <li className="flex items-center gap-2"><Glyph name="shield" className="h-3.5 w-3.5 text-burgundy" /> Damaged items can be replaced after photos are reviewed</li>
              </ul>

              <Link
                href="/checkout"
                aria-disabled={rows.length === 0}
                className={`btn-primary mt-6 w-full ${
                  rows.length === 0
                    ? "pointer-events-none cursor-not-allowed opacity-50"
                    : ""
                }`}
              >
                Proceed to Checkout
              </Link>
              <Link href="/shop" className="btn-outline mt-3 w-full">
                Continue Shopping
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function MediumBookCover({ book }: { book: { slug: string; title: string } }) {
  return (
    <div className="w-20 shrink-0">
      <MediaPlaceholder
        variant="book"
        label={book.title}
        aspectClassName="aspect-[3/4] rounded-xl"
      />
    </div>
  );
}