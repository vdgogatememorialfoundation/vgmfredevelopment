"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveFlyers, useSiteSettings } from "@/lib/use-cms";
import { useI18n } from "@/components/i18n/LanguageProvider";

const INTERVAL = 7000;
const isImage = (value?: string) =>
  Boolean(value && (/^(https?:|data:image|\/)/i.test(value) || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value)));

type ImageSlide = { id: string; title: string; image: string; href?: string };

const DEFAULT_SLIDES: ImageSlide[] = [
  { id: "slide-legacy", title: "Preserving Ayurveda. Advancing knowledge.", image: "/slides/legacy.svg", href: "/about" },
  { id: "slide-events", title: "Seminars, fellowships and workshops", image: "/slides/events.svg", href: "/events" },
  { id: "slide-shop", title: "Books and study materials from VGMF", image: "/slides/shop.svg", href: "/shop" },
];

export default function HeroSection() {
  const flyers = useLiveFlyers();
  const settings = useSiteSettings();
  const { t } = useI18n();
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const slides = useMemo<ImageSlide[]>(() => {
    const fromCms = flyers
      .filter((flyer) => isImage(flyer.image) && !failed[flyer.id])
      .map((flyer) => ({
        id: flyer.id,
        title: flyer.title,
        image: flyer.image,
        href: flyer.href?.trim() || undefined,
      }));
    return fromCms.length ? fromCms : DEFAULT_SLIDES.filter((slide) => !failed[slide.id]);
  }, [failed, flyers]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const active = count ? index % count : 0;

  const go = useCallback(
    (nextIndex: number) => {
      if (!count) return;
      setIndex((nextIndex + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), INTERVAL);
    return () => window.clearInterval(timer);
  }, [count, paused, active]);

  if (!count) {
    const tagline = settings?.tagline || t("hero.taglineFallback");
    return (
      <section className="relative isolate z-0 border-b border-border bg-[linear-gradient(135deg,#0B1F3A_0%,#16325C_62%,#2A4A73_100%)] text-white">
        <div className="container flex min-h-[132px] items-center py-5 sm:min-h-[160px]">
          <div className="max-w-2xl">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">{t("hero.kicker")}</p>
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{tagline}</h1>
          </div>
        </div>
      </section>
    );
  }

  const slide = slides[active];

  return (
    <section
      className="relative isolate z-0 bg-paper"
      aria-roledescription="carousel"
      aria-label="Foundation slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative mx-auto w-full max-w-6xl bg-stone-100">
        {slides.map((item, slideIndex) => {
          const visible = slideIndex === active;
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt={item.title || "Slideshow image"}
              className="mx-auto h-auto max-h-[min(85vh,820px)] w-full object-contain object-center"
              onError={() => setFailed((current) => ({ ...current, [item.id]: true }))}
            />
          );
          return (
            <div key={item.id} className={visible ? "relative" : "hidden"} aria-hidden={!visible}>
              {item.href ? (
                <a href={item.href} className="block" tabIndex={visible ? 0 : -1} aria-label={item.title || "Open slide"}>
                  {image}
                </a>
              ) : (
                image
              )}
            </div>
          );
        })}

        {slide.title && !slide.image.startsWith("/slides/") ? (
          <p className="pointer-events-none absolute bottom-12 left-4 right-4 z-10 max-w-3xl font-serif text-base leading-snug text-ink drop-shadow-[0_1px_8px_rgba(255,255,255,0.85)] sm:bottom-14 sm:left-16 sm:text-xl lg:text-2xl">
            {slide.title}
          </p>
        ) : null}

        {count > 1 ? (
          <div className="pointer-events-none absolute inset-0 z-30">
            <button
              type="button"
              aria-label={t("hero.prev")}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                go(active - 1);
              }}
              className="pointer-events-auto absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white text-2xl leading-none text-ink shadow-md sm:left-3"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={t("hero.next")}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                go(active + 1);
              }}
              className="pointer-events-auto absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white text-2xl leading-none text-ink shadow-md sm:right-3"
            >
              ›
            </button>
            <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {slides.map((item, slideIndex) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Show slide ${slideIndex + 1}`}
                  aria-current={slideIndex === active}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    go(slideIndex);
                  }}
                  className={`h-2 rounded-full ${slideIndex === active ? "w-5 bg-ink" : "w-2 bg-ink/30"}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        Slide {active + 1} of {count}: {slide.title}
      </p>
    </section>
  );
}
