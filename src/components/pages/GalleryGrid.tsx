"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, ImageIcon, X } from "lucide-react";
import Mandala from "@/components/graphics/Mandala";
import { galleryItems as defaultGalleryItems } from "@/data/site";
import { classNames } from "@/lib/utils";

export default function GalleryGrid({
  galleryItems = defaultGalleryItems,
}: {
  galleryItems?: typeof defaultGalleryItems;
}) {
  const categories = ["All", ...Array.from(new Set(galleryItems.map((item) => item.category)))];
  const [filter, setFilter] = useState("All");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const items = filter === "All" ? galleryItems : galleryItems.filter((item) => item.category === filter);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowRight") setLightbox((value) => (value === null ? null : (value + 1) % items.length));
      if (event.key === "ArrowLeft") setLightbox((value) => (value === null ? null : (value - 1 + items.length) % items.length));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, items.length]);

  const current = lightbox === null ? null : items[lightbox];

  return (
    <>
      <div className="mb-10 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Filter gallery">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={filter === category}
            onClick={() => setFilter(category)}
            className={classNames(
              "rounded-full px-5 py-2 text-sm font-semibold transition",
              filter === category
                ? "bg-burgundy text-white shadow-lg shadow-burgundy/25"
                : "border border-border bg-white text-text-primary hover:border-burgundy hover:text-burgundy"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid auto-rows-[220px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightbox(index)}
            className={classNames(
              "group relative overflow-hidden rounded-3xl bg-gradient-to-br text-left text-white animate-fade-up",
              item.tone,
              filter === "All" ? item.span : ""
            )}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="pointer-events-none absolute inset-0 bg-rangoli opacity-50" />
            <Mandala className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 text-white/15 transition duration-[1.4s] group-hover:rotate-90 group-hover:scale-110" />
            <ImageIcon className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/25 transition group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />
            <span className="absolute right-4 top-4 flex h-9 w-9 scale-75 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur transition group-hover:scale-100 group-hover:opacity-100">
              <Expand size={16} />
            </span>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-light">{item.category}</span>
              <p className="mt-1 font-display text-lg font-semibold leading-snug">{item.title}</p>
            </div>
          </button>
        ))}
      </div>

      {current && lightbox !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-warm-cream/95 p-4 backdrop-blur animate-[fade-up_0.3s_ease_both]"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(null);
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-burgundy shadow-md hover:bg-burgundy hover:text-white"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={() => setLightbox((lightbox - 1 + items.length) % items.length)}
            aria-label="Previous"
            className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-burgundy shadow-md hover:bg-burgundy hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <figure className="w-full max-w-4xl">
            <div className={classNames("relative aspect-[16/10] overflow-hidden rounded-3xl bg-gradient-to-br", current.tone)}>
              <div className="absolute inset-0 bg-rangoli opacity-50" />
              <Mandala className="absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 text-white/15 animate-spin-slow" />
              <ImageIcon className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-white/40" />
            </div>
            <figcaption className="mt-4 flex items-center justify-between text-text-primary">
              <span>
                <span className="block text-xs uppercase tracking-[0.18em] text-burgundy">{current.category}</span>
                <span className="font-display text-xl">{current.title}</span>
              </span>
              <span className="text-sm text-text-muted">
                {lightbox + 1} / {items.length}
              </span>
            </figcaption>
          </figure>
          <button
            type="button"
            onClick={() => setLightbox((lightbox + 1) % items.length)}
            aria-label="Next"
            className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-burgundy shadow-md hover:bg-burgundy hover:text-white"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </>
  );
}
