import type { Book } from "@/types";

export const books: Book[] = [];

export function getBookBySlug(slug: string) {
  return books.find((book) => book.slug === slug);
}

export function getFeaturedBooks() {
  return books.filter((book) => book.active !== false).slice(0, 4);
}
