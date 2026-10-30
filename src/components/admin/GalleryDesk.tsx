"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ImageField } from "@/components/admin/ImageField";
import { GALLERY_CATEGORIES, getGallery, saveGallery, type GalleryItem } from "@/lib/gallery";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const ghost = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700";

export function GalleryDesk() {
  const [items, setItems] = useState<GalleryItem[]>(() => getGallery());
  const [note, setNote] = useState("");
  const [albumName, setAlbumName] = useState("");

  const setItem = (id: string, patch: Partial<GalleryItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const save = () => {
    saveGallery(items.filter((item) => item.src));
    setItems(getGallery());
    setNote("Saved.");
  };

  const addPhoto = (album?: string) =>
    setItems((current) => [
      {
        id: `gal-${Date.now()}`,
        src: "",
        title: "",
        caption: "",
        category: "Seminars",
        album: album || albumName.trim() || "General",
        date: new Date().toISOString().slice(0, 10),
      },
      ...current,
    ]);

  const grouped = useMemo(() => {
    const map = new Map<string, GalleryItem[]>();
    for (const item of items) {
      const key = item.album?.trim() || "General";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gallery albums</h1>
          <p className="mt-1 text-sm text-slate-500">Group photographs into albums, for example a past seminar year.</p>
        </div>
        <Link href="/gallery" className={ghost}>View gallery</Link>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="min-w-[220px] flex-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Album name
          <input className={`${field} mt-1`} value={albumName} onChange={(event) => setAlbumName(event.target.value)} placeholder="Seminar 2024" />
        </label>
        <button type="button" className={button} onClick={() => addPhoto()}>
          + Add photograph
        </button>
      </div>
      {grouped.length === 0 ? <p className="text-sm text-slate-500">No photographs yet.</p> : null}
      {grouped.map(([album, photos]) => (
        <section key={album} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">{album}</h2>
            <button type="button" className={ghost} onClick={() => addPhoto(album)}>
              Add to this album
            </button>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {photos.map((item) => (
              <li key={item.id} className="grid gap-3 rounded-xl border border-slate-100 p-4 lg:grid-cols-[220px_1fr]">
                <ImageField label="Photograph" value={item.src} onChange={(src) => setItem(item.id, { src })} />
                <div className="space-y-2">
                  <input className={field} placeholder="Title" value={item.title} onChange={(event) => setItem(item.id, { title: event.target.value })} />
                  <input className={field} placeholder="Album" value={item.album ?? album} onChange={(event) => setItem(item.id, { album: event.target.value })} />
                  <select className={field} value={item.category} onChange={(event) => setItem(item.id, { category: event.target.value })}>
                    {GALLERY_CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                    {!GALLERY_CATEGORIES.includes(item.category as (typeof GALLERY_CATEGORIES)[number]) && item.category ? (
                      <option value={item.category}>{item.category}</option>
                    ) : null}
                  </select>
                  <textarea className={field} rows={2} placeholder="Caption" value={item.caption ?? ""} onChange={(event) => setItem(item.id, { caption: event.target.value })} />
                  <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" className={button} onClick={save}>Save gallery</button>
        {note ? <p className="text-sm text-emerald-700">{note}</p> : null}
      </div>
    </div>
  );
}
