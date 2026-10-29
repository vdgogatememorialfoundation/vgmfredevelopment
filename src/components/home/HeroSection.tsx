"use client";

import Link from "next/link";
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
  const slides = useMemo<ImageSlide[]>(() => {
    const fromCms = flyers
      .filter((flyer) => isImage(flyer.image))
      .map((flyer) => ({
        id: flyer.id,
        title: flyer.title,
        image: flyer.image,
        href: flyer.href?.trim() || undefined,
      }));
    return fromCms.length ? fromCms : DEFAULT_SLIDES;
  }, [flyers]);

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
      <section className="relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,#0B1F3A_0%,#16325C_62%,#2A4A73_100%)] text-white">
        <div className="container flex h-[160px] items-center py-5 sm:h-[200px] lg:h-[240px]">
          <div className="max-w-2xl">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">{t("hero.kicker")}</p>
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{tagline}</h1>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/events" className="btn-primary bg-white text-ink hover:bg-paper">
                {t("hero.exploreEvents")}
              </Link>
              <Link href="/about/legacy-of-vaidya-rb-gogate" className="btn-ghost">
                {t("hero.discoverLegacy")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const slide = slides[active];

  return (
    <section
      className="relative isolate z-0 overflow-hidden border-b border-border bg-ink"
      aria-roledescription="carousel"
      aria-label="Foundation slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-[160px] w-full overflow-hidden sm:h-[200px] lg:h-[240px]">
        {slides.map((item, slideIndex) => {
          const visible = slideIndex === active;
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt={item.title || "Slideshow image"} className="absolute inset-0 h-full w-full object-cover object-center" />
          );
          return (
            <div
              key={item.id}
              className={`absolute inset-0 overflow-hidden transition-opacity duration-700 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!visible}
            >
              {item.href ? (
                <a href={item.href} className="absolute inset-0" tabIndex={visible ? 0 : -1} aria-label={item.title || "Open slide link"}>
                  {image}
                </a>
              ) : (
                image
              )}
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label={t("hero.prev")}
            onClick={() => go(active - 1)}
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-white/90 text-base text-ink shadow-sm hover:bg-white sm:left-3"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t("hero.next")}
            onClick={() => go(active + 1)}
            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-white/90 text-base text-ink shadow-sm hover:bg-white sm:right-3"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
            {slides.map((item, slideIndex) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show slide ${slideIndex + 1}`}
                aria-current={slideIndex === active}
                onClick={() => go(slideIndex)}
                className={`h-1.5 rounded-full transition-all ${slideIndex === active ? "w-5 bg-white shadow ring-1 ring-ink/20" : "w-1.5 bg-white/70 hover:bg-white"}`}
              />
            ))}
          </div>
        </>
      ) : null}

      <p className="sr-only" aria-live="polite">
        Slide {active + 1} of {count}: {slide.title}
      </p>
    </section>
  );
}
