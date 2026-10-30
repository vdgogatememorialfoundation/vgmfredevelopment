"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { galleryAlbums, galleryCategories, useGallery } from "@/lib/gallery";
import { useI18n } from "@/components/i18n/LanguageProvider";

export function GalleryView() {
  const { t } = useI18n();
  const items = useGallery();
  const categories = galleryCategories(items);
  const albums = galleryAlbums(items);
  const [category, setCategory] = useState("all");
  const [album, setAlbum] = useState("all");
  const shown = useMemo(
    () =>
      items
        .filter((item) => item.src)
        .filter((item) => category === "all" || item.category === category)
        .filter((item) => album === "all" || (item.album || "General") === album),
    [items, category, album]
  );
  const grouped = useMemo(() => {
    const map = new Map<string, typeof shown>();
    for (const photo of shown) {
      const key = photo.album?.trim() || "General";
      const list = map.get(key) ?? [];
      list.push(photo);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [shown]);

  return (
    <main>
      <PageHeader
        eyebrow={t("gallery.eyebrow")}
        title={t("gallery.title")}
        description={t("gallery.desc")}
        breadcrumb={[{ name: t("nav.gallery"), href: "/gallery" }]}
      />
      <section className="section-paper">
        <div className="container">
          {albums.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAlbum("all")}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  album === "all" ? "border-ink bg-ink text-white" : "border-border text-ink hover:border-burgundy"
                }`}
              >
                All albums
              </button>
              {albums.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setAlbum(name)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    album === name ? "border-ink bg-ink text-white" : "border-border text-ink hover:border-burgundy"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                category === "all" ? "border-ink bg-ink text-white" : "border-border text-ink hover:border-burgundy"
              }`}
            >
              {t("gallery.all")}
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
              {t("gallery.empty")}
            </p>
          ) : (
            <div className="space-y-10">
              {grouped.map(([name, photos]) => (
                <section key={name}>
                  <h2 className="mb-4 font-serif text-xl font-semibold text-ink">{name}</h2>
                  <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {photos.map((photo) => (
                      <li key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.src} alt={photo.title || photo.caption || ""} className="aspect-square w-full object-contain bg-paper" />
                        <div className="p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-burgundy">{photo.category}</p>
                          {photo.title ? <p className="mt-1 font-semibold text-ink">{photo.title}</p> : null}
                          {photo.caption ? <p className="mt-1 text-sm leading-6 text-text-muted">{photo.caption}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
