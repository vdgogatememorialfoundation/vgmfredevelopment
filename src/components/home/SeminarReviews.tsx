"use client";

import { useEffect, useState } from "react";
import Stars from "@/components/store/Stars";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { subscribeCms } from "@/lib/cms";
import {
  defaultSeminarReviews,
  getPublishedSeminarReviews,
  hydrateReviewsFromServer,
  type SeminarReview,
} from "@/lib/reviews";

export default function SeminarReviews() {
  const { t } = useI18n();
  const [items, setItems] = useState<SeminarReview[]>(defaultSeminarReviews);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const refresh = () => setItems(getPublishedSeminarReviews());
    refresh();
    const unsubscribe = subscribeCms(refresh);
    void hydrateReviewsFromServer().then(refresh);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), 7000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;
  const active = items[index % items.length];

  return (
    <section className="border-t border-border bg-ink py-10 text-white sm:py-12" aria-labelledby="seminar-reviews-heading">
      <div className="container">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{t("home.reviewsEyebrow")}</p>
          <h2 id="seminar-reviews-heading" className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">
            {t("home.reviewsTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/75">{t("home.reviewsDesc")}</p>
        </div>

        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-ink-soft px-6 py-8 sm:px-10">
          <div key={active.id} className="text-center">
            <Stars rating={active.rating} />
            <p className="mt-5 font-serif text-xl leading-8 text-white sm:text-2xl">“{active.text}”</p>
            <p className="mt-6 text-sm font-semibold text-white">{active.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-gold">{active.event}</p>
          </div>
          {items.length > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-2">
              {items.map((item, slide) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Show review ${slide + 1}`}
                  aria-current={slide === index % items.length}
                  onClick={() => setIndex(slide)}
                  className={`h-2 rounded-full ${slide === index % items.length ? "w-5 bg-white" : "w-2 bg-white/40"}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
