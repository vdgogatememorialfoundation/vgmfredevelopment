"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteLogo from "@/components/common/SiteLogo";
import { useLiveFlyers, useSiteSettings } from "@/lib/use-cms";

const isImage = (value?: string) => Boolean(value && /^(https?:|data:image)/.test(value));

function StaticHero({ tagline }: { tagline?: string }) {
  const lines = (tagline || "Preserving Ayurveda. Advancing Knowledge. Serving Society.").split(/(?<=\.)\s+/);
  return (
    <section className="relative overflow-hidden border-b border-border bg-white">
      <div className="container grid items-center gap-8 py-10 lg:grid-cols-2 lg:py-12">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Vaidya Gogate Memorial Foundation</p>
          <h1 className="heading-1 max-w-2xl">
            {lines.map((line, index) => (
              <span key={index} className="block">{line}</span>
            ))}
          </h1>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/events" className="btn-primary">Explore Events</Link>
            <Link href="/about/legacy-of-vaidya-rb-gogate" className="btn-secondary">Discover Our Legacy</Link>
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="flex h-full items-center justify-center bg-slate-50 p-6 text-center">
              <div>
                <SiteLogo size={72} className="mx-auto mb-3" />
                <h2 className="text-base font-semibold text-text-primary">Vaidya Gogate Memorial Foundation</h2>
                <p className="mt-1 text-xs text-text-muted">Ayurveda • Education</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HeroSection() {
  const flyers = useLiveFlyers();
  const settings = useSiteSettings();
  const slides = flyers.filter((flyer) => isImage(flyer.image));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);

  if (!slides.length) return <StaticHero tagline={settings?.tagline} />;

  const active = index % slides.length;

  return (
    <section
      className="relative overflow-hidden border-b border-border bg-white"
      aria-roledescription="carousel"
      aria-label="Featured banners"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[16/9] w-full sm:aspect-[21/8] lg:max-h-[280px]">
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ${slideIndex === active ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={slideIndex !== active}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.image} alt={slide.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/60 to-transparent" />
            <div className="container absolute inset-0 flex items-center">
              <div className="max-w-xl">
                {slide.event && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">{slide.event}</p>}
                <h2 className="text-lg font-semibold text-text-primary sm:text-xl">{slide.title}</h2>
                {slide.href && (
                  <Link href={slide.href} className="btn-primary mt-4" tabIndex={slideIndex === active ? 0 : -1}>
                    {slide.cta || "Learn more"}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => setIndex((active - 1 + slides.length) % slides.length)}
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-text-primary shadow-sm hover:text-burgundy sm:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => setIndex((active + 1) % slides.length)}
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-text-primary shadow-sm hover:text-burgundy sm:flex"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show banner ${slideIndex + 1}`}
                onClick={() => setIndex(slideIndex)}
                className={`h-2.5 rounded-full transition-all ${slideIndex === active ? "w-8 bg-burgundy" : "w-2.5 bg-white shadow"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
