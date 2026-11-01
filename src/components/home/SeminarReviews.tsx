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
    <section className="border-t border-border bg-ink py-5 text-white sm:py-6" aria-labelledby="seminar-reviews-heading">
      <div className="container">
        <div className="mx-auto mb-3 max-w-xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">{t("home.reviewsEyebrow")}</p>
          <h2 id="seminar-reviews-heading" className="mt-1 font-serif text-lg font-semibold sm:text-xl">
            {t("home.reviewsTitle")}
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-white/70">{t("home.reviewsDesc")}</p>
        </div>

        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-xl border border-white/15 bg-ink-soft px-4 py-4 sm:px-6">
          <div key={active.id} className="text-center">
            <Stars rating={active.rating} />
            <p className="mt-2 font-serif text-base leading-6 text-white sm:text-lg">“{active.text}”</p>
            <p className="mt-3 text-xs font-semibold text-white">{active.name}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-gold">{active.event}</p>
          </div>
          {items.length > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {items.map((item, slide) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Show review ${slide + 1}`}
                  aria-current={slide === index % items.length}
                  onClick={() => setIndex(slide)}
                  className={`h-1.5 rounded-full ${slide === index % items.length ? "w-4 bg-white" : "w-1.5 bg-white/40"}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
