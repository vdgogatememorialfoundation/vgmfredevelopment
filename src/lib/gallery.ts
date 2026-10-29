import { subscribeCms } from "@/lib/cms";
import { useSyncExternalStore } from "react";

const KEY = "vgmf_gallery";

export const GALLERY_CATEGORIES = ["Foundation", "Seminars", "Clinics", "Events", "Archives", "Community"] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number] | string;

export interface GalleryItem {
  id: string;
  src: string;
  title: string;
  caption?: string;
  category: string;
  date?: string;
}

const empty: GalleryItem[] = [];

function read(): GalleryItem[] {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GalleryItem[]) : empty;
  } catch {
    return empty;
  }
}

export function getGallery() {
  return read();
}

export function saveGallery(items: GalleryItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function galleryCategories(items = read()) {
  const extra = items.map((item) => item.category).filter(Boolean);
  return [...new Set([...GALLERY_CATEGORIES, ...extra])];
}

let cachedRaw: string | null = "\0";
let cached: GalleryItem[] = empty;

export function useGallery() {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = window.localStorage.getItem(KEY);
      if (raw === cachedRaw) return cached;
      cachedRaw = raw;
      cached = read();
      return cached;
    },
    () => empty
  );
}
