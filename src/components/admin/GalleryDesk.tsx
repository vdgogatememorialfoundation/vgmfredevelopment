"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageField } from "@/components/admin/ImageField";
import { GALLERY_CATEGORIES, getGallery, saveGallery, type GalleryItem } from "@/lib/gallery";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const ghost = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700";

export function GalleryDesk() {
  const [items, setItems] = useState<GalleryItem[]>(() => getGallery());
  const [note, setNote] = useState("");

  const setItem = (id: string, patch: Partial<GalleryItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const save = () => {
    saveGallery(items.filter((item) => item.src));
    setItems(getGallery());
    setNote("Saved. The public Gallery page now shows these photographs.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gallery</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add photographs of the Foundation, seminars, clinics and other programmes. Choose a category for each image.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/gallery" className={ghost}>View gallery</Link>
          <button
            type="button"
            className={ghost}
            onClick={() =>
              setItems((current) => [
                { id: `gal-${Date.now()}`, src: "", title: "", caption: "", category: "Foundation", date: new Date().toISOString().slice(0, 10) },
                ...current,
              ])
            }
          >
            + Add photograph
          </button>
        </div>
      </div>
      {items.length === 0 ? <p className="text-sm text-slate-500">No photographs yet.</p> : null}
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[220px_1fr]">
            <ImageField label="Photograph" value={item.src} onChange={(src) => setItem(item.id, { src })} />
            <div className="space-y-2">
              <input className={field} placeholder="Title" value={item.title} onChange={(event) => setItem(item.id, { title: event.target.value })} />
              <select className={field} value={item.category} onChange={(event) => setItem(item.id, { category: event.target.value })}>
                {GALLERY_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
                {!GALLERY_CATEGORIES.includes(item.category as (typeof GALLERY_CATEGORIES)[number]) && item.category ? (
                  <option value={item.category}>{item.category}</option>
                ) : null}
              </select>
              <input className={field} placeholder="Or type a custom category" value={item.category} onChange={(event) => setItem(item.id, { category: event.target.value })} />
              <textarea className={field} rows={2} placeholder="Caption" value={item.caption ?? ""} onChange={(event) => setItem(item.id, { caption: event.target.value })} />
              <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button type="button" className={button} onClick={save}>Save gallery</button>
        {note ? <p className="text-sm text-emerald-700">{note}</p> : null}
      </div>
    </div>
  );
}
