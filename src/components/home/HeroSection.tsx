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
      <section className="relative isolate z-0 overflow-hidden border-b border-border bg-[linear-gradient(135deg,#0B1F3A_0%,#16325C_62%,#2A4A73_100%)] text-white">
        <div className="container flex min-h-[280px] items-center py-10 sm:min-h-[360px] lg:min-h-[420px]">
          <div className="max-w-2xl">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">{t("hero.kicker")}</p>
            <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{tagline}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/85 sm:text-base">{t("hero.taglineFallback")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
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
      className="relative isolate z-0 border-b border-border bg-[#0B1F3A]"
      aria-roledescription="carousel"
      aria-label="Foundation slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative mx-auto w-full max-w-[1600px]">
        {slides.map((item, slideIndex) => {
          const visible = slideIndex === active;
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt={item.title || "Slideshow image"}
              className="mx-auto block h-auto w-full max-h-[70vh] object-contain object-center"
            />
          );
          return (
            <div
              key={item.id}
              className={visible ? "relative flex min-h-[220px] items-center justify-center sm:min-h-0" : "hidden"}
              aria-hidden={!visible}
            >
              {item.href ? (
                <a href={item.href} className="block w-full" tabIndex={visible ? 0 : -1} aria-label={item.title || "Open slide link"}>
                  {image}
                </a>
              ) : (
                image
              )}
            </div>
          );
        })}

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label={t("hero.prev")}
              onClick={() => go(active - 1)}
              className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-white text-lg text-ink shadow-sm hover:bg-paper sm:flex"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={t("hero.next")}
              onClick={() => go(active + 1)}
              className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-white text-lg text-ink shadow-sm hover:bg-paper sm:flex"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {slide.title ? (
        <p className="px-5 pb-1 pt-3 text-center font-serif text-xl leading-snug text-white sm:hidden">{slide.title}</p>
      ) : null}

      {count > 1 ? (
        <div className="flex items-center justify-center gap-2 bg-[#0B1F3A] py-3">
          {slides.map((item, slideIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show slide ${slideIndex + 1}`}
              aria-current={slideIndex === active}
              onClick={() => go(slideIndex)}
              className={`h-2.5 rounded-full transition-all ${slideIndex === active ? "w-8 bg-white shadow" : "w-2.5 bg-white/50 hover:bg-white"}`}
            />
          ))}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        Slide {active + 1} of {count}: {slide.title}
      </p>
    </section>
  );
}
