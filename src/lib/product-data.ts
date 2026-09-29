import { books } from "@/data/books";
import type { AdminCategory, Book, ProductOverride } from "@/types";

const OVERRIDES_KEY = "vgmf_admin_products";
const CUSTOM_KEY = "vgmf_custom_books";
const CATS_KEY = "vgmf_categories";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getOverrides(): ProductOverride[] {
  return readJSON<ProductOverride[]>(OVERRIDES_KEY, []);
}

export function getOverride(bookId: string): ProductOverride | undefined {
  return getOverrides().find((o) => o.bookId === bookId);
}

export function applyOverride(book: Book, override?: ProductOverride): Book {
  if (!override) return book;
  return {
    ...book,
    description: override.description ?? book.description,
    price: override.price ?? book.price,
    originalPrice: override.originalPrice ?? book.originalPrice,
    stock: override.stock ?? book.stock,
    category: override.category ?? book.category,
    seller: override.manufacturer ?? book.seller,
    specifications: override.specifications ?? book.specifications,
  } as Book;
}

export function getCustomBooks(): Book[] {
  return readJSON<Book[]>(CUSTOM_KEY, []);
}

export function getLiveBooks(): Book[] {
  const overrides = getOverrides();
  return [...books, ...getCustomBooks()].map((book) =>
    applyOverride(book, overrides.find((o) => o.bookId === book.id))
  );
}

export function getLiveBook(id: string): Book | undefined {
  return getLiveBooks().find((book) => book.id === id);
}

export function saveProductOverride(override: ProductOverride) {
  const list = getOverrides().filter((o) => o.bookId !== override.bookId);
  list.push(override);
  writeJSON(OVERRIDES_KEY, list);
}

export function addCustomBook(book: Book) {
  const list = getCustomBooks().filter((b) => b.id !== book.id);
  list.push(book);
  writeJSON(CUSTOM_KEY, list);
}

export function updateCustomBook(book: Book) {
  addCustomBook(book);
}

export function removeCustomBook(id: string) {
  writeJSON(
    CUSTOM_KEY,
    getCustomBooks().filter((b) => b.id !== id)
  );
}

export function updateStock(bookId: string, stock: number) {
  const currently = getOverride(bookId);
  saveProductOverride({
    ...currently,
    bookId,
    stock,
    active: currently?.active ?? true,
  });
}

export function inventorySnapshot(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const book of getLiveBooks()) map[book.id] = book.stock;
  return map;
}

export function getCategories(): AdminCategory[] {
  const seeded: AdminCategory[] = books.map((book) => ({
    id: book.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: book.category,
    slug: book.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    sortOrder: 0,
    active: true,
  }));
  const seen = new Set<string>();
  const uniq = seeded.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const stored = readJSON<AdminCategory[]>(CATS_KEY, []);
  const merged = [...stored, ...uniq.filter((s) => !stored.some((c) => c.id === s.id))];
  return merged;
}

export function getCategory(id: string): AdminCategory | undefined {
  return getCategories().find((c) => c.id === id);
}

export function saveCategory(category: AdminCategory) {
  const list = getCategories().filter((c) => c.id !== category.id);
  list.push(category);
  writeJSON(CATS_KEY, list);
}

export function deleteCategory(id: string) {
  writeJSON(
    CATS_KEY,
    getCategories().filter((c) => c.id !== id)
  );
}

export function generateBarcode(prefix = "890") {
  const body = prefix + Math.floor(Math.random() * 9000000000).toString().padStart(9, "0");
  return body.slice(0, 13);
}

export function stockLevel(book: Book): "in" | "low" | "out" {
  if (book.stock <= 0) return "out";
  if (book.stock <= 5) return "low";
  return "in";
}