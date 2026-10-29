"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { galleryCategories, useGallery } from "@/lib/gallery";

export function GalleryView() {
  const items = useGallery();
  const categories = galleryCategories(items);
  const [category, setCategory] = useState("all");
  const shown = useMemo(
    () => (category === "all" ? items : items.filter((item) => item.category === category)).filter((item) => item.src),
    [items, category]
  );

  return (
    <main>
      <PageHeader
        eyebrow="Gallery"
        title="Gallery"
        description="Photographs from the Foundation, seminars, clinics and community programmes. Categories are set when images are added in Admin → Website → Gallery."
        breadcrumb={[{ name: "Gallery", href: "/gallery" }]}
      />
      <section className="section-paper">
        <div className="container">
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                category === "all" ? "border-ink bg-ink text-white" : "border-border text-ink hover:border-burgundy"
              }`}
            >
              All
            </button>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  category === item ? "border-ink bg-ink text-white" : "border-border text-ink hover:border-burgundy"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-muted">
              No photographs in this category yet.
            </p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((photo) => (
                <li key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.src} alt={photo.title || photo.caption || ""} className="aspect-[4/3] w-full object-cover" />
                  <div className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-burgundy">{photo.category}</p>
                    {photo.title ? <p className="mt-1 font-semibold text-ink">{photo.title}</p> : null}
                    {photo.caption ? <p className="mt-1 text-sm leading-6 text-text-muted">{photo.caption}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
