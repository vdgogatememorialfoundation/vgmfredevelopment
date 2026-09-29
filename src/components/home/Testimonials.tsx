"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import { testimonials } from "@/data/site";
import { classNames } from "@/lib/utils";

export default function Testimonials() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = testimonials.length;

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setActive((value) => (value + 1) % total), 6000);
    return () => clearInterval(timer);
  }, [paused, total]);

  const go = (delta: number) => setActive((value) => (value + delta + total) % total);

  return (
    <section className="section relative overflow-hidden bg-warm-cream" aria-labelledby="testimonials-heading">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-50" />
      <div className="container relative">
        <SectionHeading
          id="testimonials-heading"
          eyebrow="Voices"
          title="What our community says"
          description="Physicians, scholars, students and patients on their experience with the Foundation."
        />

        <div
          className="relative mx-auto max-w-4xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative min-h-[320px] sm:min-h-[280px]">
            {testimonials.map((item, index) => (
              <figure
                key={item.name}
                aria-hidden={index !== active}
                className={classNames(
                  "absolute inset-0 rounded-3xl border border-border bg-white p-8 shadow-[0_30px_60px_-35px_rgb(10_26_51/0.4)] transition-all duration-700 sm:p-12",
                  index === active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
                )}
              >
                <Quote className="absolute right-8 top-8 h-16 w-16 text-burgundy/10" />
                <div className="flex gap-1 text-gold">
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star key={star} size={16} fill="currentColor" />
                  ))}
                </div>
                <blockquote className="mt-5 font-display text-xl leading-relaxed text-text-primary sm:text-2xl">
                  “{item.quote}”
                </blockquote>
                <figcaption className="mt-7 flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-burgundy to-navy font-semibold text-white">
                    {item.name
                      .replace(/^(Dr\.|Vaidya)\s/, "")
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span>
                    <span className="block font-semibold text-text-primary">{item.name}</span>
                    <span className="block text-sm text-text-muted">{item.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous testimonial"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-text-primary transition hover:border-burgundy hover:text-burgundy"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-2">
              {testimonials.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show testimonial ${index + 1}`}
                  className={classNames(
                    "h-2 rounded-full transition-all duration-300",
                    index === active ? "w-8 bg-burgundy" : "w-2 bg-border hover:bg-burgundy/40"
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next testimonial"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-text-primary transition hover:border-burgundy hover:text-burgundy"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
