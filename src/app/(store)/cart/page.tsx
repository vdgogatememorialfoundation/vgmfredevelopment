"use client";

import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { useCart } from "@/lib/use-cart";
import {
  getBookById,
  setCartQuantity,
  removeFromCart,
  toggleWishlist,
  computeTotals,
  formatPrice,
  getEstimatedDeliveryDate,
} from "@/lib/store";
import { storeConfig } from "@/lib/constants";

export default function CartPage() {
  const { items } = useCart();

  const rows = items.flatMap((item) => {
    const book = getBookById(item.bookId);
    return book ? [{ item, book }] : [];
  });

  const totals = computeTotals(
    rows.map((row) => ({
      price: row.book.price,
      originalPrice: row.book.originalPrice,
      quantity: row.item.quantity,
    }))
  );

  const shippingFree = totals.subtotal >= storeConfig.freeShippingThreshold;

  return (
    <main>
      <PageHeader
        eyebrow="Store"
        title="Shopping Cart"
        description="Review the items in your cart before proceeding to checkout."
      />

      <section className="section bg-background">
        <div className="container grid max-w-6xl gap-10 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-cream text-burgundy">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="21" r="1" />
                    <circle cx="19" cy="21" r="1" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                  </svg>
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
                      Sold by {book.seller ?? storeConfig.sellerName} ·{" "}
                      {book.sku ? `SKU: ${book.sku}` : book.author}
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <span className="font-bold text-text-primary">
                        {formatPrice(book.price * item.quantity)}
                      </span>
                      {book.originalPrice && book.originalPrice > book.price && (
                        <span className="text-sm text-text-muted line-through">
                          {formatPrice(book.originalPrice * item.quantity)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-emerald-700">
                      Delivery by {getEstimatedDeliveryDate(6)} ·{" "}
                      {book.expectedDelivery}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="flex items-center rounded-lg border border-border">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() =>
                            setCartQuantity(item.bookId, item.quantity - 1)
                          }
                          className="flex h-9 w-9 items-center justify-center transition hover:text-burgundy"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() =>
                            setCartQuantity(item.bookId, item.quantity + 1)
                          }
                          className="flex h-9 w-9 items-center justify-center transition hover:text-burgundy"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          toggleWishlist(item.bookId);
                          removeFromCart(item.bookId);
                        }}
                        className="text-xs font-semibold text-text-muted transition hover:text-burgundy"
                      >
                        Move to Wishlist
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.bookId)}
                        className="text-xs font-semibold text-red-600 transition hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}

            <div className="rounded-2xl border border-border bg-white p-5 text-xs text-text-muted">
              <p className="font-semibold text-text-primary">
                Returns & cancellation
              </p>
              <p className="mt-1">
                You can cancel within {storeConfig.cancellationWindowDays} day
                of placing your order. Returnable within{" "}
                {storeConfig.returnDays} days of delivery for a refund or
                replacement.
              </p>
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="heading-3">Price Details</h2>
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
                  <dt className="text-text-muted">Subtotal</dt>
                  <dd className="font-medium text-text-primary">
                    {formatPrice(totals.subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">GST</dt>
                  <dd className="font-medium text-text-primary">
                    {formatPrice(totals.gst)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Shipping</dt>
                  <dd className="font-medium text-text-primary">
                    {totals.shipping === 0 ? "FREE" : formatPrice(totals.shipping)}
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

              {!shippingFree && totals.subtotal > 0 && (
                <p className="mt-3 rounded-lg bg-warm-cream p-3 text-xs text-text-muted">
                  Add {formatPrice(storeConfig.freeShippingThreshold - totals.subtotal)}{" "}
                  more to get FREE shipping.
                </p>
              )}

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