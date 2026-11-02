"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Stars from "@/components/store/Stars";
import { useAuth } from "@/components/auth/AuthContext";
import { subscribeCms } from "@/lib/cms";
import {
  averageRating,
  findProductReview,
  hasPurchasedProduct,
  hydrateReviewsFromServer,
  listProductReviews,
  saveProductReview,
  type ProductReview,
} from "@/lib/reviews";
import { formatDate } from "@/lib/utils";

export default function ProductReviews({
  productId,
  productTitle,
  productSlug,
}: {
  productId: string;
  productTitle: string;
  productSlug: string;
}) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  useEffect(() => {
    const refresh = () => setReviews(listProductReviews(productId));
    refresh();
    const unsubscribe = subscribeCms(refresh);
    void hydrateReviewsFromServer().then(refresh);
    return unsubscribe;
  }, [productId]);
  const rating = averageRating(reviews);
  const purchased = hasPurchasedProduct(user?.email, user?.id, productId);
  const existing = user?.email ? findProductReview(productId, user.email) : undefined;
  const [open, setOpen] = useState(false);

  return (
    <section id="reviews" className="section border-t border-border bg-warm-cream">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="heading-3">Ratings & reviews</h2>
            <p className="mt-1 text-sm text-text-muted">
              Reviews here are from people who purchased {productTitle}. Seminar feedback lives on the homepage.
            </p>
            {reviews.length > 0 ? (
              <div className="mt-3 flex items-center gap-2">
                <Stars rating={rating} />
                <span className="text-sm font-semibold text-ink">{rating.toFixed(1)}</span>
                <span className="text-sm text-text-muted">({reviews.length} {reviews.length === 1 ? "review" : "reviews"})</span>
              </div>
            ) : null}
          </div>
          {user ? (
            purchased ? (
              <button type="button" className="btn-primary" onClick={() => setOpen((value) => !value)}>
                {existing ? "Edit your review" : "Write a review"}
              </button>
            ) : (
              <p className="max-w-xs text-right text-xs text-text-muted">
                Buy this product to write a review. Reviews are only from confirmed purchases.
              </p>
            )
          ) : (
            <Link href={`/login?next=/shop/${productSlug}`} className="btn-primary">
              Sign in to write a review
            </Link>
          )}
        </div>

        {open && user && purchased ? (
          <ReviewForm
            productId={productId}
            name={`${user.firstName} ${user.lastName}`.trim()}
            email={user.email}
            existing={existing}
            onDone={() => setOpen(false)}
          />
        ) : null}

        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-text-primary">{review.name}</p>
                    <Stars rating={review.rating} size="sm" />
                    {review.verified ? (
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-burgundy">Verified purchase</p>
                    ) : null}
                  </div>
                  <time className="text-xs text-text-muted">{formatDate(review.date)}</time>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-text-primary">{review.text}</p>
                {review.reply?.text ? (
                  <div className="mt-4 rounded-xl border border-ink/10 bg-ink/[0.04] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                      Reply from {review.reply.author || "the Foundation"}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-text-primary">{review.reply.text}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">
            No purchase reviews yet for this product.
          </p>
        )}
      </div>
    </section>
  );
}

function ReviewForm({
  productId,
  name,
  email,
  existing,
  onDone,
}: {
  productId: string;
  name: string;
  email: string;
  existing?: ReturnType<typeof findProductReview>;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [text, setText] = useState(existing?.text ?? "");
  const [note, setNote] = useState("");
  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  return (
    <form
      className="mb-6 space-y-4 rounded-2xl border border-border bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) {
          setNote("Write a few words about the product.");
          return;
        }
        saveProductReview({
          id: existing?.id,
          productId,
          name,
          email,
          rating,
          text,
          verified: true,
        });
        setNote("Thank you. Your review is on the product page.");
        onDone();
      }}
    >
      <p className="font-semibold text-ink">{existing ? "Update your review" : "Write a review"}</p>
      <div className="flex items-center gap-2">
        {stars.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`text-2xl leading-none ${value <= rating ? "text-gold" : "text-border"}`}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="input-field min-h-28"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="How was the book or product after you received it?"
      />
      {note ? <p className="text-sm text-burgundy">{note}</p> : null}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary">
          {existing ? "Save review" : "Publish review"}
        </button>
        <button type="button" className="btn-outline" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
