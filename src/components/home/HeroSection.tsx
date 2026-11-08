"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLiveFlyers, useSiteSettings } from "@/lib/use-cms";
import { useI18n } from "@/components/i18n/LanguageProvider";

const INTERVAL = 7000;
const isImage = (value?: string) =>
  Boolean(
    value &&
    (/^(https?:|data:image|\/)/i.test(value) ||
      /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value)),
  );

type ImageSlide = {
  id: string;
  title: string;
  image: string;
  href?: string;
  isMobile?: boolean;
  isDesktop?: boolean;
};

const DEFAULT_SLIDES: ImageSlide[] = [
  {
    id: "slide-legacy",
    title: "Preserving Ayurveda. Advancing knowledge.",
    image: "/slides/legacy.svg",
    href: "/about",
  },
  {
    id: "slide-events",
    title: "Seminars, fellowships and workshops",
    image: "/slides/events.svg",
    href: "/events",
  },
  {
    id: "slide-shop",
    title: "Books and study materials from VGMF",
    image: "/slides/shop.svg",
    href: "/shop",
  },
];

/** Phones get a tall frame so a poster is readable. Wider screens keep a short banner strip. */
const SLIDE_BOX =
  "relative h-[70vw] min-h-[260px] max-h-[440px] w-full overflow-hidden bg-paper sm:h-[220px] sm:min-h-[220px] sm:max-h-[220px] lg:h-[240px] lg:min-h-[240px] lg:max-h-[240px]";

export default function HeroSection() {
  const flyers = useLiveFlyers();
  const settings = useSiteSettings();
  const { t } = useI18n();
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [phone, setPhone] = useState(false);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);
  const [lightbox, setLightbox] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhone(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  const slides = useMemo<ImageSlide[]>(() => {
    const fromCms = flyers
      .filter((flyer) => isImage(flyer.image) && !failed[flyer.id])
      .map((flyer) => ({
        id: flyer.id,
        title: flyer.title,
        image: flyer.image,
        href: flyer.href?.trim() || undefined,
        isMobile: flyer.isMobile,
        isDesktop: flyer.isDesktop,
      }));
    const fitted = fromCms.filter((flyer) =>
      phone ? flyer.isMobile !== false : flyer.isDesktop !== false,
    );
    const chosen = (fitted.length ? fitted : fromCms).map(
      ({ isMobile: _mobile, isDesktop: _desktop, ...slide }) => slide,
    );
    return chosen.length
      ? chosen
      : DEFAULT_SLIDES.filter((slide) => !failed[slide.id]);
  }, [failed, flyers, phone]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const active = count ? index % count : 0;

  const go = useCallback(
    (nextIndex: number) => {
      if (!count) return;
      setIndex((nextIndex + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % count),
      INTERVAL,
    );
    return () => window.clearInterval(timer);
  }, [count, paused, active]);

  if (!count) {
    const tagline = settings?.tagline || t("hero.taglineFallback");
    return (
      <section className="relative isolate z-0 border-b border-border bg-white text-ink">
        <div className="container flex min-h-[132px] items-center py-5 sm:min-h-[160px]">
          <div className="max-w-2xl">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
              {t("hero.kicker")}
            </p>
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              {tagline}
            </h1>
          </div>
        </div>
      </section>
    );
  }

  const slide = slides[active];

  return (
    <section
      className="relative isolate z-0 overflow-hidden bg-white"
      aria-roledescription="carousel"
      aria-label="Foundation slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        touchX.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchX.current == null) return;
        const delta =
          (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(delta) > 40) {
          swiped.current = true;
          if (delta > 40) go(active - 1);
          if (delta < -40) go(active + 1);
        }
      }}
    >
      <div className={SLIDE_BOX}>
        {slides.map((item, slideIndex) => {
          const visible = slideIndex === active;
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt={item.title || "Slideshow image"}
              className={`absolute inset-0 !h-full !w-full !max-w-none object-contain object-center ${item.image.includes("/slides/") ? "object-bottom" : ""}`}
              onError={() =>
                setFailed((current) => ({ ...current, [item.id]: true }))
              }
            />
          );
          return (
            <div
              key={item.id}
              className={`absolute inset-0 z-0 overflow-hidden bg-white transition-opacity duration-700 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!visible}
            >
              <button
                type="button"
                className="absolute inset-0"
                tabIndex={visible ? 0 : -1}
                aria-label={item.title ? `Open ${item.title}` : "Open flyer"}
                onClick={() => {
                  if (swiped.current) {
                    swiped.current = false;
                    return;
                  }
                  if (visible) setLightbox(true);
                }}
              >
                {image}
              </button>
            </div>
          );
        })}
        {slide.title && !slide.image.startsWith("/slides/") ? (
          <p className="pointer-events-none absolute bottom-8 left-14 right-14 z-10 font-serif text-base leading-snug text-ink sm:bottom-8 sm:left-16 sm:text-xl lg:text-2xl">
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
            <p className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink">
              {active + 1} / {count}
            </p>
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
      {lightbox && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={slide.title || "Flyer"}
            >
              <button
                type="button"
                className="absolute inset-0 bg-ink/80"
                aria-label="Close flyer"
                onClick={() => setLightbox(false)}
              />
              <div className="relative z-10 flex w-full max-w-4xl flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => setLightbox(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-xl text-ink shadow-lg"
                  aria-label="Close flyer"
                >
                  ×
                </button>
                <div className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.image}
                    alt={slide.title || "Flyer"}
                    className="block h-auto max-h-[76dvh] w-full !max-w-none bg-paper object-contain"
                  />
                  {(slide.title || slide.href) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">
                        {slide.title}
                      </p>
                      {slide.href ? (
                        <a
                          href={slide.href}
                          className="text-sm font-semibold text-burgundy"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
