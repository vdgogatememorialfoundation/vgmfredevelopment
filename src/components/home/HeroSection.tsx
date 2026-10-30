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

/** Compact strip heights from the current homepage setting. Large images stay inside this box. */
const SLIDE_BOX = "relative h-[168px] w-full overflow-hidden sm:h-[188px] lg:h-[220px]";

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
      className="relative isolate z-0 overflow-hidden bg-ink"
      aria-roledescription="carousel"
      aria-label="Foundation slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={SLIDE_BOX}>
        {slides.map((item, slideIndex) => {
          const visible = slideIndex === active;
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt={item.title || "Slideshow image"}
              className={`absolute inset-0 object-contain object-center ${item.image.includes("/slides/") ? "object-bottom" : ""}`}
              style={{ width: "100%", height: "100%", maxWidth: "none", maxHeight: "none" }}
              onError={() => setFailed((current) => ({ ...current, [item.id]: true }))}
            />
          );
          return (
            <div
              key={item.id}
              className={`absolute inset-0 z-0 overflow-hidden bg-ink transition-opacity duration-700 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!visible}
            >
              {item.href ? (
                <a href={item.href} className="absolute inset-0" tabIndex={visible ? 0 : -1} aria-label={item.title || "Open slide"}>
                  {image}
                </a>
              ) : (
                image
              )}
            </div>
          );
        })}
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
        {slide.title && !slide.image.startsWith("/slides/") ? (
          <p className="pointer-events-none absolute bottom-8 left-14 right-14 z-10 font-serif text-base leading-snug text-white drop-shadow sm:bottom-8 sm:left-16 sm:text-xl lg:text-2xl">
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
            <div className="pointer-events-auto absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
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
                  className={`h-2 rounded-full ${slideIndex === active ? "w-5 bg-white" : "w-2 bg-white/60"}`}
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
