import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/common/Badge";
import RequireAuth from "@/components/auth/RequireAuth";
import BookCard from "@/components/books/BookCard";
import ProductBuyBox from "@/components/store/ProductBuyBox";
import MediaGallery from "@/components/store/MediaGallery";
import Stars from "@/components/store/Stars";
import { books } from "@/data/books";
import { storeConfig } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getDiscountPercent } from "@/lib/store";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return books.map((book) => ({ slug: book.slug }));
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = books.find((item) => item.slug === slug);

  if (!book) return {};

  return {
    title: book.title,
    description: book.description,
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;
  const book = books.find((item) => item.slug === slug);

  if (!book) {
    notFound();
  }

  const related = books
    .filter((item) => item.slug !== book.slug)
    .slice(0, 3);

  const discount = getDiscountPercent(book);
  const rating = book.rating ?? 0;
  const reviewCount = book.reviewCount ?? book.reviews?.length ?? 0;

  return (
    <RequireAuth message="Sign in to browse the Foundation shop and view product details.">
      <main>
        <section className="border-b border-border bg-warm-cream">
          <div className="container py-10 sm:py-14">
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                <li>
                  <Link href="/" className="transition hover:text-burgundy">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/shop" className="transition hover:text-burgundy">
                    Shop
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <span className="font-medium text-text-primary">
                    {book.title}
                  </span>
                </li>
              </ol>
            </nav>

            <div className="grid gap-10 lg:grid-cols-5">
              {/* Media gallery */}
              <div className="lg:col-span-2">
                <MediaGallery book={book} />
              </div>

              {/* Info + buy box */}
              <div className="lg:col-span-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="burgundy">{book.category}</Badge>
                  {book.sku && (
                    <span className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-text-muted">
                      Book code / SKU: {book.sku}
                    </span>
                  )}
                  {book.edition && (
                    <span className="text-sm text-text-muted">
                      {book.edition}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-start justify-between gap-4">
                  <h1 className="heading-3 sm:heading-1">{book.title}</h1>
                  {discount > 0 && (
                    <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                      {discount}% OFF
                    </span>
                  )}
                </div>

                {/* Seller + author */}
                <p className="mt-3 text-sm text-text-muted">
                  By{" "}
                  <span className="font-medium text-burgundy">{book.author}</span>
                  {" · "}Sold by{" "}
                  <span className="font-medium text-text-primary">
                    {book.seller ?? storeConfig.sellerName}
                  </span>
                </p>

                {/* Rating */}
                {reviewCount > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Stars rating={rating} />
                    <a
                      href="#reviews"
                      className="text-sm font-medium text-burgundy hover:underline"
                    >
                      {rating.toFixed(1)}
                    </a>
                    <span className="text-sm text-text-muted">
                      ({reviewCount} rating{reviewCount === 1 ? "" : "s"})
                    </span>
                  </div>
                )}

                <ProductBuyBox book={book} />

                <p className="mt-4 text-xs text-text-muted">
                  Prices are inclusive of all taxes. Payments processed
                  securely via Razorpay; orders are dispatched by our courier
                  partner with end-to-end tracking. Signature on delivery
                  protects your purchase.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Description + specifications */}
        <section className="section bg-background">
          <div className="container mx-auto max-w-3xl">
            <h2 className="heading-3 mb-5">Product Information</h2>
            <p className="text-body">{book.description}</p>

            {(book.specifications?.length ?? 0) > 0 && (
              <div className="mt-10">
                <h2 className="heading-3 mb-5">Specifications</h2>
                <div className="overflow-hidden rounded-2xl border border-border bg-white">
                  <dl>
                    {(book.specifications ?? []).map((spec, index) => (
                      <div
                        key={spec.label}
                        className={`grid grid-cols-3 gap-4 px-5 py-3.5 text-sm ${
                          index % 2 === 1 ? "bg-warm-cream/60" : ""
                        }`}
                      >
                        <dt className="font-medium text-text-muted">
                          {spec.label}
                        </dt>
                        <dd className="col-span-2 text-text-primary">
                          {spec.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            {(book.countryOfOrigin || book.isbn || book.seller) && (
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {book.seller && (
                  <div className="rounded-xl border border-border bg-white p-4">
                    <dt className="text-xs text-text-muted">Sold by</dt>
                    <dd className="mt-1 text-sm font-semibold text-text-primary">
                      {book.seller}
                    </dd>
                  </div>
                )}
                {book.countryOfOrigin && (
                  <div className="rounded-xl border border-border bg-white p-4">
                    <dt className="text-xs text-text-muted">Country of origin</dt>
                    <dd className="mt-1 text-sm font-semibold text-text-primary">
                      {book.countryOfOrigin}
                    </dd>
                  </div>
                )}
                {book.isbn && (
                  <div className="rounded-xl border border-border bg-white p-4">
                    <dt className="text-xs text-text-muted">ISBN</dt>
                    <dd className="mt-1 text-sm font-semibold text-text-primary">
                      {book.isbn}
                    </dd>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Reviews */}
        <section id="reviews" className="section border-t border-border bg-warm-cream">
          <div className="container mx-auto max-w-3xl">
            <h2 className="heading-3 mb-6">Ratings & Reviews</h2>

            {(book.reviews?.length ?? 0) > 0 ? (
              <>
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5">
                  <p className="text-4xl font-bold text-text-primary">
                    {rating.toFixed(1)}
                  </p>
                  <div>
                    <Stars rating={rating} size="lg" />
                    <p className="mt-1 text-sm text-text-muted">
                      {reviewCount} rating{reviewCount === 1 ? "" : "s"} ·{" "}
                      {book.reviewCount ?? 0} reviews
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {(book.reviews ?? []).map((review) => (
                    <article
                      key={review.id}
                      className="rounded-2xl border border-border bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-text-primary">
                            {review.name}
                          </p>
                          <Stars rating={review.rating} size="sm" />
                        </div>
                        <time className="text-xs text-text-muted">
                          {formatDate(review.date)}
                        </time>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-text-primary">
                        {review.text}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">
                No reviews yet for this product. Be the first to write one.
              </p>
            )}
          </div>
        </section>

        {related.length > 0 && (
          <section className="section bg-background">
            <div className="container">
              <h2 className="heading-3 mb-8">Related Products</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((item) => (
                  <BookCard key={item.id} book={item} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </RequireAuth>
  );
}