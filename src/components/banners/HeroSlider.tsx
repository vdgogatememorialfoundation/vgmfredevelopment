"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Mandala from "@/components/graphics/Mandala";
import Lotus from "@/components/graphics/Lotus";
import type { Banner } from "@/lib/cms/defaults";
import { bannerTheme } from "@/components/banners/themes";
import { classNames } from "@/lib/utils";

export default function HeroSlider({
  banners,
  interval = 6,
}: {
  banners: Banner[];
  interval?: number;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = banners.length;

  const go = useCallback(
    (delta: number) => setActive((value) => (value + delta + total) % total),
    [total]
  );

  useEffect(() => {
    if (paused || total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => go(1), Math.max(3, interval) * 1000);
    return () => clearInterval(timer);
  }, [paused, total, interval, go]);

  if (!total) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Foundation highlights"
      className="bg-background py-6 sm:py-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl shadow-xl ring-1 ring-gold/30">
          <div className="relative h-[340px] sm:h-[380px] lg:h-[420px]">
            {banners.map((banner, index) => (
              <article
                key={banner.id}
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${total}`}
                aria-hidden={index !== active}
                className={classNames(
                  "absolute inset-0 flex items-center bg-gradient-to-br text-white transition-all duration-700 ease-out",
                  bannerTheme(banner.theme),
                  index === active ? "opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                {banner.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={banner.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-soft-light"
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-0 bg-rangoli opacity-40" />
                <Mandala
                  className={classNames(
                    "pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] text-white/25 transition duration-[2s]",
                    index === active ? "rotate-45" : "rotate-0"
                  )}
                />
                <Lotus className="pointer-events-none absolute bottom-4 right-8 hidden h-28 w-28 opacity-90 drop-shadow-lg md:block" />

                <div
                  className={classNames(
                    "relative z-10 max-w-2xl px-6 transition-all duration-700 sm:px-12",
                    index === active ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                  )}
                >
                  {banner.eyebrow ? (
                    <p className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ring-1 ring-white/40 backdrop-blur-sm">
                      {banner.eyebrow}
                    </p>
                  ) : null}
                  <h2 className="mt-4 font-serif text-3xl font-bold leading-tight drop-shadow-sm sm:text-4xl lg:text-5xl">
                    {banner.title}
                  </h2>
                  {banner.subtitle ? (
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/90 sm:text-base">
                      {banner.subtitle}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-wrap gap-3">
                    {banner.ctaLabel && banner.ctaHref ? (
                      <Link
                        href={banner.ctaHref}
                        tabIndex={index === active ? 0 : -1}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-burgundy shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                      >
                        {banner.ctaLabel}
                        <ArrowRight size={16} />
                      </Link>
                    ) : null}
                    {banner.secondaryLabel && banner.secondaryHref ? (
                      <Link
                        href={banner.secondaryHref}
                        tabIndex={index === active ? 0 : -1}
                        className="inline-flex items-center gap-2 rounded-full border border-white/70 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                      >
                        {banner.secondaryLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {total > 1 ? (
            <div className="absolute inset-x-0 bottom-4 z-20 flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2">
                {banners.map((banner, index) => (
                  <button
                    key={banner.id}
                    type="button"
                    aria-label={`Show slide ${index + 1}`}
                    aria-current={index === active}
                    onClick={() => setActive(index)}
                    className={classNames(
                      "h-2.5 rounded-full bg-white transition-all",
                      index === active ? "w-8" : "w-2.5 opacity-60 hover:opacity-100"
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={paused ? "Play slideshow" : "Pause slideshow"}
                  onClick={() => setPaused((value) => !value)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white ring-1 ring-white/50 backdrop-blur transition hover:bg-white/40"
                >
                  {paused ? <Play size={15} /> : <Pause size={15} />}
                </button>
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => go(-1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white ring-1 ring-white/50 backdrop-blur transition hover:bg-white/40"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Next slide"
                  onClick={() => go(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white ring-1 ring-white/50 backdrop-blur transition hover:bg-white/40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
