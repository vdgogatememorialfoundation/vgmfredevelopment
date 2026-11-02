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
import { useSiteText } from "@/lib/use-site-text";
import type { ReviewsTheme } from "@/lib/site-text";

const themes: Record<ReviewsTheme, { section: string; eyebrow: string; title: string; desc: string; card: string; quote: string; name: string; event: string; dot: string; dotIdle: string; arrow: string }> = {
  white: {
    section: "border-t border-border bg-white",
    eyebrow: "text-burgundy",
    title: "text-ink",
    desc: "text-text-muted",
    card: "border-border bg-paper shadow-sm",
    quote: "text-ink",
    name: "text-ink",
    event: "text-burgundy",
    dot: "bg-burgundy",
    dotIdle: "bg-border",
    arrow: "border-border bg-white text-ink hover:border-gold hover:text-burgundy",
  },
  paper: {
    section: "border-t border-border bg-paper",
    eyebrow: "text-burgundy",
    title: "text-ink",
    desc: "text-text-muted",
    card: "border-border bg-white shadow-sm",
    quote: "text-ink",
    name: "text-ink",
    event: "text-burgundy",
    dot: "bg-burgundy",
    dotIdle: "bg-border",
    arrow: "border-border bg-white text-ink hover:border-gold hover:text-burgundy",
  },
  navy: {
    section: "border-t border-border bg-ink",
    eyebrow: "text-gold",
    title: "text-white",
    desc: "text-white/70",
    card: "border-white/15 bg-ink-soft",
    quote: "text-white",
    name: "text-white",
    event: "text-gold",
    dot: "bg-white",
    dotIdle: "bg-white/40",
    arrow: "border-white/25 bg-white/10 text-white hover:bg-white hover:text-ink",
  },
};

export default function SeminarReviews() {
  const { t } = useI18n();
  const controls = useSiteText().reviews;
  const look = themes[controls.theme] ?? themes.white;
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
    if (items.length < 2 || controls.autoplaySeconds <= 0) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), controls.autoplaySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [items.length, controls.autoplaySeconds]);

  if (!items.length) return null;
  const current = index % items.length;
  const active = items[current];
  const step = (delta: number) => setIndex((current + delta + items.length) % items.length);

  return (
    <section className={`${look.section} py-6 sm:py-7`} aria-labelledby="seminar-reviews-heading">
      <div className="container">
        <div className="mx-auto mb-3 max-w-xl text-center">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${look.eyebrow}`}>{t("home.reviewsEyebrow")}</p>
          <h2 id="seminar-reviews-heading" className={`mt-1 font-serif text-lg font-semibold sm:text-xl ${look.title}`}>
            {t("home.reviewsTitle")}
          </h2>
        </div>

        <div className="relative mx-auto flex max-w-2xl items-center gap-3">
          {controls.showArrows && items.length > 1 ? (
            <button type="button" aria-label="Previous review" onClick={() => step(-1)} className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg sm:flex ${look.arrow}`}>
              ‹
            </button>
          ) : null}
          <div className={`min-w-0 flex-1 overflow-hidden rounded-xl border px-4 py-4 sm:px-6 ${look.card}`}>
            <div key={active.id} className="text-center">
              {controls.showPhoto && active.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.photo} alt={active.name} className="mx-auto mb-3 h-14 w-14 rounded-full border border-border object-cover" />
              ) : null}
              {controls.showStars ? <Stars rating={active.rating} /> : null}
              <p className={`mt-2 font-serif text-base leading-6 sm:text-lg ${look.quote}`}>“{active.text}”</p>
              <p className={`mt-3 text-xs font-semibold ${look.name}`}>{active.name}</p>
              {controls.showEvent && active.event ? (
                <p className={`mt-0.5 text-[10px] uppercase tracking-[0.14em] ${look.event}`}>{active.event}</p>
              ) : null}
            </div>
            {controls.showDots && items.length > 1 ? (
              <div className="mt-3 flex items-center justify-center gap-1.5">
                {items.map((item, slide) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Show review ${slide + 1}`}
                    aria-current={slide === current}
                    onClick={() => setIndex(slide)}
                    className={`h-1.5 rounded-full ${slide === current ? `w-4 ${look.dot}` : `w-1.5 ${look.dotIdle}`}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
          {controls.showArrows && items.length > 1 ? (
            <button type="button" aria-label="Next review" onClick={() => step(1)} className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg sm:flex ${look.arrow}`}>
              ›
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
