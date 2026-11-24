import type { Book } from "@/types";

export type Ribbon = { text: string; className: string };

/** Strips the desk switched on for a product: Trending (green), New (until its date), and an optional custom one. */
export function productRibbons(book: Book, now = Date.now()): Ribbon[] {
  const ribbons: Ribbon[] = [];
  if (book.trending) ribbons.push({ text: "Trending", className: "bg-emerald-600 text-white" });
  if (book.isNew && (!book.newUntil || Date.parse(`${book.newUntil}T23:59:59`) >= now)) ribbons.push({ text: "New", className: "bg-burgundy text-white" });
  if (book.ribbon?.trim()) ribbons.push({ text: book.ribbon.trim(), className: "bg-amber-500 text-white" });
  return ribbons;
}

export const GRID_COLUMNS: Record<number, string> = {
  3: "lg:grid-cols-3 xl:grid-cols-3",
  4: "lg:grid-cols-4 xl:grid-cols-4",
  5: "lg:grid-cols-4 xl:grid-cols-5",
  6: "lg:grid-cols-5 xl:grid-cols-6",
};

export const CARD_STYLES: Record<string, string> = {
  bordered: "",
  shadow: "shadow-md hover:shadow-lg",
  minimal: "border-transparent shadow-none bg-transparent",
};

export const CARD_IMAGE: Record<string, string> = {
  small: "max-w-28",
  medium: "max-w-36",
  large: "max-w-52",
  full: "max-w-none",
};
