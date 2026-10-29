"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveFlyers, useSiteSettings } from "@/lib/use-cms";

type SlideTone = "navy" | "blue" | "ice";

type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  lines?: string[];
  text?: string;
  kicker?: string;
  href?: string;
  cta?: string;
  secondaryHref?: string;
  secondaryCta?: string;
  image?: string;
  tone: SlideTone;
};

const INTERVAL = 7000;

const isImage = (value?: string) => Boolean(value && /^(https?:|data:image)/.test(value));

const tones: Record<SlideTone, string> = {
  navy: "bg-[linear-gradient(135deg,#0B1F3A_0%,#16325C_62%,#2A4A73_100%)] text-white",
  blue: "bg-[linear-gradient(135deg,#16325C_0%,#2A4A73_70%,#B8953A_140%)] text-white",
  ice: "bg-[linear-gradient(135deg,#FFFDF8_0%,#F7F3EA_55%,#E8DCC4_100%)] text-ink",
};

function foundationSlide(tagline?: string): HeroSlide {
  const text = tagline || "Preserving Ayurveda. Advancing Knowledge. Serving Society.";
  return {
    id: "hero-foundation",
    eyebrow: "Vaidya Gogate Memorial Foundation",
    title: text,
    lines: text.split(/(?<=\.)\s+/).filter(Boolean),
    text: "Ayurveda education, publications and clinical care.",
    kicker: "Ayurveda • Education",
    href: "/events",
    cta: "Explore Events",
    secondaryHref: "/about/legacy-of-vaidya-rb-gogate",
    secondaryCta: "Discover Our Legacy",
    tone: "navy",
  };
}

const extraSlides: HeroSlide[] = [
  {
    id: "hero-legacy",
    eyebrow: "Our legacy",
    title: "The work of Vaidya R. B. Gogate",
    text: "Clinical care, teaching and publications continued in his memory.",
    href: "/about/legacy-of-vaidya-rb-gogate",
    cta: "Discover Our Legacy",
    tone: "ice",
  },
];

export default function HeroSection() {
  const flyers = useLiveFlyers();
  const settings = useSiteSettings();

  const slides = useMemo(() => {
    const next: HeroSlide[] = [foundationSlide(settings?.tagline)];
    const tonesCycle: SlideTone[] = ["blue", "navy", "ice"];

    flyers.forEach((flyer, flyerIndex) => {
      next.push({
        id: flyer.id,
        eyebrow: flyer.event || "Poster",
        title: flyer.title,
        text: flyer.event,
        href: flyer.href,
        cta: flyer.cta || "Learn more",
        image: isImage(flyer.image) ? flyer.image : undefined,
        tone: tonesCycle[flyerIndex % tonesCycle.length],
      });
    });

    if (flyers.length === 0) {
      for (const slide of extraSlides) next.push(slide);
    }
    return next;
  }, [flyers, settings?.tagline]);

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(active + 1);
      if (event.key === "ArrowLeft") go(active - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

  const slide = slides[active];
  if (!slide) return null;

  return (
    <section
      className="relative overflow-hidden border-b border-border"
      aria-roledescription="carousel"
      aria-label="Foundation slideshow"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative min-h-[420px] sm:min-h-[460px] lg:min-h-[500px]">
        {slides.map((item, slideIndex) => {
          const onIce = item.tone === "ice";
          const visible = slideIndex === active;
          return (
            <div
              key={item.id}
              className={`absolute inset-0 transition-opacity duration-700 ${tones[item.tone]} ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!visible}
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              {item.image ? <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/25" /> : null}
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.18) 0, transparent 28%), radial-gradient(circle at 88% 70%, rgba(255,255,255,0.12) 0, transparent 32%)",
                }}
              />
              <div className="container relative grid min-h-[420px] items-center gap-8 py-12 sm:min-h-[460px] lg:min-h-[500px] lg:grid-cols-[1.2fr_0.8fr]">
                <div className="max-w-2xl">
                  <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${onIce && !item.image ? "text-gold" : "text-amber-100"}`}>
                    {item.eyebrow}
                  </p>
                  <h1 className={`font-serif text-3xl font-semibold tracking-tight sm:text-4xl ${item.image ? "text-white" : ""}`}>
                    {(item.lines ?? [item.title]).map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </h1>
                  {item.text ? (
                    <p className={`mt-4 max-w-xl text-sm leading-6 ${onIce && !item.image ? "text-text-muted" : "text-white/85"}`}>
                      {item.text}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-wrap gap-3">
                    {item.href && item.cta ? (
                      <Link href={item.href} className={onIce && !item.image ? "btn-primary" : "btn-primary bg-white text-ink hover:bg-paper"} tabIndex={visible ? 0 : -1}>
                        {item.cta}
                      </Link>
                    ) : null}
                    {item.secondaryHref && item.secondaryCta ? (
                      <Link href={item.secondaryHref} className={onIce && !item.image ? "btn-outline" : "btn-ghost"} tabIndex={visible ? 0 : -1}>
                        {item.secondaryCta}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="hidden justify-end lg:flex">
                  <div className={`flex aspect-square w-64 flex-col items-center justify-center rounded-full border ${onIce && !item.image ? "border-burgundy/20 bg-white/80 text-ink" : "border-white/25 bg-white/10 text-white"} backdrop-blur-sm`}>
                    <span className="font-serif text-4xl font-semibold tracking-tight">VGMF</span>
                    <p className="mt-2 px-6 text-center text-sm font-medium">Vaidya Gogate Memorial Foundation</p>
                    <p className={`mt-1 text-xs ${onIce && !item.image ? "text-text-muted" : "text-white/75"}`}>{item.kicker || "Ayurveda • Education"}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(active - 1)}
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-white text-lg text-ink shadow-sm hover:bg-paper sm:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(active + 1)}
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-white text-lg text-ink shadow-sm hover:bg-paper sm:flex"
          >
            ›
          </button>
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {slides.map((item, slideIndex) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show slide ${slideIndex + 1}: ${item.title}`}
                aria-current={slideIndex === active}
                onClick={() => go(slideIndex)}
                className={`h-2.5 rounded-full transition-all ${slideIndex === active ? "w-8 bg-white shadow ring-1 ring-ink/20" : "w-2.5 bg-white/70 hover:bg-white"}`}
              />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-ink/15">
            <div
              key={`${slide.id}-${paused}`}
              className={`h-full origin-left bg-white ${paused ? "" : "hero-progress"}`}
            />
          </div>
        </>
      ) : null}

      <p className="sr-only" aria-live="polite">
        Slide {active + 1} of {count}: {slide.title}
      </p>
    </section>
  );
}
