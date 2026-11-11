"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Badge from "@/components/common/Badge";
import BookCard from "@/components/books/BookCard";
import ProductBuyBox from "@/components/store/ProductBuyBox";
import ProductShare from "@/components/store/ProductShare";
import MediaGallery from "@/components/store/MediaGallery";
import ProductReviews from "@/components/store/ProductReviews";
import BookDetails from "@/components/store/BookDetails";
import Stars from "@/components/store/Stars";
import { averageRating, useProductReviews } from "@/lib/reviews";
import { useLiveBooks, useOrderSettings, useSiteSettings } from "@/lib/use-cms";
import { storeConfig } from "@/lib/constants";
import { getDiscountPercent } from "@/lib/store";
import { browserHasProductEdits, freshCatalogue } from "@/components/store/ShopCatalogue";
import type { Book } from "@/types";

export default function ShopProduct({
  slug,
  initialBook = null,
  initialBooks = [],
}: {
  slug: string;
  initialBook?: Book | null;
  initialBooks?: Book[];
}) {
  const live = useLiveBooks();
  const [useLocal, setUseLocal] = useState(false);
  useEffect(() => {
    if (browserHasProductEdits()) setUseLocal(true);
  }, [live]);
  const catalogue = useLocal && live.length ? freshCatalogue(initialBooks, live) : initialBooks;
  const book = catalogue.find((item) => item.slug === slug) ?? initialBook;
  const purchaseReviews = useProductReviews(book?.id ?? "");
  const shopRules = useOrderSettings();
  const languageSize = useSiteSettings()?.productText?.pageLanguage || 24;

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
  const rating = purchaseReviews.length ? averageRating(purchaseReviews) : book.rating ?? 0;
  const reviewCount = purchaseReviews.length || book.reviewCount || 0;
  const writtenReviews = purchaseReviews.length
    ? purchaseReviews.filter((review) => String((review as { comment?: string; text?: string; body?: string }).comment ?? (review as { text?: string }).text ?? (review as { body?: string }).body ?? "").trim()).length
    : book.reviews?.length ?? 0;
  const canReturn = book.policy?.returns ?? shopRules.returns.enabled;
  const canReplace = book.policy?.replacement ?? (shopRules.returns.enabled && shopRules.returns.replacementAllowed);
  const canCancel = book.policy?.cancellation ?? shopRules.cancellation.enabled;
  const until = shopRules.cancellation.allowedUntil === "Ordered" ? "packing" : shopRules.cancellation.allowedUntil === "Packed" ? "dispatch" : "delivery";
  const policyLines = [
    { label: "Return", ok: canReturn, text: canReturn ? `${shopRules.returns.windowDays}-day return after delivery` : "Not returnable" },
    { label: "Replacement", ok: canReplace, text: canReplace ? "Damaged or wrong items can be replaced after photos are reviewed" : "No replacement" },
    { label: "Cancellation", ok: canCancel, text: canCancel ? `Can be cancelled before ${until}` : "Cannot be cancelled once ordered" },
  ];
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
                {book.language ? (
                  <>
                    {" · "}Language: <span className="rounded bg-burgundy/10 px-2 py-0.5 align-middle font-extrabold text-burgundy" style={{ fontSize: languageSize }}>{book.language}</span>
                  </>
                ) : null}
              </p>
              <ProductShare slug={book.slug} title={book.title} price={book.price} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {reviewCount > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-sm font-bold text-white">{rating.toFixed(1)} ★</span>
                    <Stars rating={rating} />
                    <a href="#reviews" className="text-sm font-medium text-burgundy hover:underline">
                      {reviewCount} rating{reviewCount === 1 ? "" : "s"} & {writtenReviews} review{writtenReviews === 1 ? "" : "s"}
                    </a>
                  </>
                ) : (
                  <a href="#reviews" className="text-sm text-text-muted hover:underline">No ratings yet · be the first to review</a>
                )}
              </div>
              {book.offerLabel ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                  {book.offerLabel}{book.offer?.endsAt ? ` · ends ${new Date(book.offer.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                </p>
              ) : null}
              <ProductBuyBox book={book} />
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                {policyLines.map((line) => (
                  <li key={line.label} className={`rounded-lg border px-3 py-2 ${line.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-border bg-slate-50 text-text-muted"}`}>
                    <b className="block">{line.label}</b>
                    {line.text}
                  </li>
                ))}
              </ul>
              {book.policy?.note ? <p className="mt-2 text-xs text-text-muted">{book.policy.note}</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-background">
        <div className="container mx-auto max-w-3xl">
          <h2 className="heading-3 mb-5">Product information</h2>
          <BookDetails book={book} />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {publisher && (
              <div className="rounded-xl border border-border bg-white p-4">
                <dt className="text-xs text-text-muted">Publisher</dt>
                <dd className="mt-1 text-sm font-semibold text-text-primary">{publisher}</dd>
                {book.publisher?.address && <p className="mt-1 text-xs text-text-muted">{book.publisher.address}</p>}
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
