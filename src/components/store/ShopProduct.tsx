"use client";

import Link from "next/link";
import Badge from "@/components/common/Badge";
import BookCard from "@/components/books/BookCard";
import ProductBuyBox from "@/components/store/ProductBuyBox";
import MediaGallery from "@/components/store/MediaGallery";
import ProductReviews from "@/components/store/ProductReviews";
import Stars from "@/components/store/Stars";
import { averageRating, useProductReviews } from "@/lib/reviews";
import { useLiveBooks } from "@/lib/use-cms";
import { storeConfig } from "@/lib/constants";
import { getDiscountPercent } from "@/lib/store";
import { books as seeded } from "@/data/books";

export default function ShopProduct({ slug }: { slug: string }) {
  const live = useLiveBooks();
  const catalogue = live.length ? live : seeded;
  const book = catalogue.find((item) => item.slug === slug);

  if (!book) {
    return (
      <main className="section">
        <div className="container max-w-xl text-center">
          <h1 className="heading-3">This product is not listed</h1>
          <p className="mt-3 text-sm text-text-muted">It may have been removed from the shop.</p>
          <Link href="/shop" className="btn-outline mt-6">Back to shop</Link>
        </div>
      </main>
    );
  }

  const related = catalogue.filter((item) => item.slug !== book.slug).slice(0, 4);
  const discount = getDiscountPercent(book);
  const purchaseReviews = useProductReviews(book.id);
  const rating = purchaseReviews.length ? averageRating(purchaseReviews) : book.rating ?? 0;
  const reviewCount = purchaseReviews.length || book.reviewCount || 0;
  const publisher = book.publisher?.name ?? storeConfig.publisherName;

  return (
    <main>
      <section className="border-b border-border bg-warm-cream">
        <div className="container py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <li><Link href="/" className="transition hover:text-burgundy">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/shop" className="transition hover:text-burgundy">Shop</Link></li>
              <li aria-hidden="true">/</li>
              <li><span className="font-medium text-text-primary">{book.title}</span></li>
            </ol>
          </nav>

          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <MediaGallery book={book} />
            </div>
            <div className="lg:col-span-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="burgundy">{book.category}</Badge>
                {book.sku && (
                  <span className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-text-muted">
                    SKU {book.sku}
                  </span>
                )}
                {book.productCode && (
                  <span className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-text-muted">
                    Code {book.productCode}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <h1 className="heading-3 sm:heading-1">{book.title}</h1>
                {discount > 0 && (
                  <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{discount}% OFF</span>
                )}
              </div>
              <p className="mt-3 text-sm text-text-muted">
                By <span className="font-medium text-burgundy">{book.author}</span>
                {" · "}Published by <span className="font-medium text-text-primary">{publisher}</span>
              </p>
              {reviewCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Stars rating={rating} />
                  <a href="#reviews" className="text-sm font-medium text-burgundy hover:underline">{rating.toFixed(1)}</a>
                  <span className="text-sm text-text-muted">({reviewCount} ratings)</span>
                </div>
              )}
              <ProductBuyBox book={book} />
              <p className="mt-4 text-xs text-text-muted">
                Sign in or register to place an order. Add a title to the cart or buy now, then continue to checkout.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-background">
        <div className="container mx-auto max-w-3xl">
          <h2 className="heading-3 mb-5">Product information</h2>
          <p className="text-body">{book.description}</p>
          {(book.specifications?.length ?? 0) > 0 && (
            <div className="mt-10">
              <h2 className="heading-3 mb-5">Specifications</h2>
              <div className="overflow-hidden rounded-2xl border border-border bg-white">
                <dl>
                  {(book.specifications ?? []).map((spec, index) => (
                    <div key={spec.label} className={`grid grid-cols-3 gap-4 px-5 py-3.5 text-sm ${index % 2 === 1 ? "bg-warm-cream/60" : ""}`}>
                      <dt className="font-medium text-text-muted">{spec.label}</dt>
                      <dd className="col-span-2 text-text-primary">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {publisher && (
              <div className="rounded-xl border border-border bg-white p-4">
                <dt className="text-xs text-text-muted">Publisher</dt>
                <dd className="mt-1 text-sm font-semibold text-text-primary">{publisher}</dd>
                {book.publisher?.address && <p className="mt-1 text-xs text-text-muted">{book.publisher.address}</p>}
              </div>
            )}
            {book.isbn && (
              <div className="rounded-xl border border-border bg-white p-4">
                <dt className="text-xs text-text-muted">ISBN</dt>
                <dd className="mt-1 text-sm font-semibold text-text-primary">{book.isbn}</dd>
              </div>
            )}
            {book.countryOfOrigin && (
              <div className="rounded-xl border border-border bg-white p-4">
                <dt className="text-xs text-text-muted">Country of origin</dt>
                <dd className="mt-1 text-sm font-semibold text-text-primary">{book.countryOfOrigin}</dd>
              </div>
            )}
          </div>
        </div>
      </section>

      <ProductReviews productId={book.id} productTitle={book.title} productSlug={book.slug} />

      {related.length > 0 && (
        <section className="section bg-background">
          <div className="container">
            <h2 className="heading-3 mb-8">Related products</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <BookCard key={item.id} book={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
