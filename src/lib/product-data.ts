import { books } from "@/data/books";
import type { AdminCategory, Book, Order, ProductOverride } from "@/types";
import { queueNotification } from "@/lib/notify";
import { pushInbox } from "@/lib/inbox";

const OVERRIDES_KEY = "vgmf_admin_products";
const CUSTOM_KEY = "vgmf_custom_books";
const DELETED_KEY = "vgmf_deleted_books";
const CATS_KEY = "vgmf_categories";
const ALERTS_KEY = "vgmf_stock_alerts";

export const LOW_STOCK_AT = 5;

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
  window.dispatchEvent(new Event("vgmf-cms"));
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
    barcode: override.barcode ?? book.barcode,
    specifications: override.specifications ?? book.specifications,
  };
}

/* ---------------- Availability ---------------- */

export function isPurchasable(book: Pick<Book, "stock" | "stockStatus">) {
  return book.stockStatus !== "out_of_stock" && book.stock > 0;
}

export function canPreorder(book: Pick<Book, "stock" | "stockStatus" | "preorder">) {
  return !isPurchasable(book) && Boolean(book.preorder?.enabled);
}

export function canOrder(book: Pick<Book, "stock" | "stockStatus" | "preorder">) {
  return isPurchasable(book) || canPreorder(book);
}

export function availabilityText(book: Pick<Book, "stock" | "stockStatus" | "preorder">) {
  if (isPurchasable(book)) return book.stock <= LOW_STOCK_AT ? `Only ${book.stock} left` : "In Stock";
  if (canPreorder(book)) return "Pre-order";
  return "Out of Stock";
}

export function stockLevel(book: Pick<Book, "stock" | "stockStatus">): "in" | "low" | "out" {
  if (!isPurchasable(book)) return "out";
  if (book.stock <= LOW_STOCK_AT) return "low";
  return "in";
}

function normalize(book: Book): Book {
  const stock = Math.max(0, Math.floor(book.stock ?? 0));
  const stockStatus = book.stockStatus ?? (stock > 0 ? "in_stock" : "out_of_stock");
  const next = { ...book, stock, stockStatus };
  return { ...next, availability: availabilityText(next) };
}

/* ---------------- Catalogue ---------------- */

export function getCustomBooks(): Book[] {
  return readJSON<Book[]>(CUSTOM_KEY, []);
}

export function getDeletedIds(): string[] {
  return readJSON<string[]>(DELETED_KEY, []);
}

/** Every product including drafts hidden from the shop. */
export function getAllProducts(): Book[] {
  const overrides = getOverrides();
  const deleted = new Set(getDeletedIds());
  const custom = getCustomBooks();
  const customIds = new Set(custom.map((book) => book.id));
  const seeds = books.filter((book) => !customIds.has(book.id));
  return [...custom, ...seeds]
    .filter((book) => !deleted.has(book.id))
    .map((book) => normalize(applyOverride(book, overrides.find((o) => o.bookId === book.id))));
}

/** Products visible in the shop. */
export function getLiveBooks(): Book[] {
  return getAllProducts().filter((book) => book.active !== false);
}

export function getLiveBook(id: string): Book | undefined {
  return getAllProducts().find((book) => book.id === id);
}

export function getLiveBookBySlug(slug: string): Book | undefined {
  return getLiveBooks().find((book) => book.slug === slug);
}

export function getProductByCode(code: string): Book | undefined {
  const value = code.trim().toLowerCase();
  if (!value) return undefined;
  return getAllProducts().find((book) =>
    [book.productCode, book.sku, book.barcode, book.isbn?.replace(/-/g, ""), book.id]
      .filter(Boolean)
      .some((item) => String(item).toLowerCase() === value || String(item).toLowerCase() === value.replace(/-/g, ""))
  );
}

/** Saves a full product record. Sends back-in-stock emails when it becomes orderable from stock again. */
export function saveProduct(book: Book) {
  const before = getLiveBook(book.id);
  const record = normalize({ ...book, createdAt: book.createdAt ?? new Date().toISOString() });
  const list = getCustomBooks().filter((item) => item.id !== book.id);
  list.unshift(record);
  writeJSON(CUSTOM_KEY, list);
  writeJSON(OVERRIDES_KEY, getOverrides().filter((o) => o.bookId !== book.id));
  writeJSON(DELETED_KEY, getDeletedIds().filter((id) => id !== book.id));
  if (before && before.stock !== record.stock) {
    pushInbox({
      audience: "staff",
      kind: "stock",
      title: `Stock updated: ${record.title}`,
      body: `${record.sku || record.id}: ${before.stock} → ${record.stock} units.`,
      href: "/admin/commerce/inventory",
    });
  }
  if (before && !isPurchasable(before) && isPurchasable(record) && record.active !== false) {
    notifyBackInStock(record);
  }
  return record;
}

export function deleteProduct(id: string) {
  writeJSON(CUSTOM_KEY, getCustomBooks().filter((book) => book.id !== id));
  writeJSON(OVERRIDES_KEY, getOverrides().filter((o) => o.bookId !== id));
  writeJSON(DELETED_KEY, Array.from(new Set([...getDeletedIds(), id])));
}

export function addCustomBook(book: Book) {
  saveProduct(book);
}

export function updateCustomBook(book: Book) {
  saveProduct(book);
}

export function removeCustomBook(id: string) {
  deleteProduct(id);
}

export function saveProductOverride(override: ProductOverride) {
  const book = getLiveBook(override.bookId);
  if (!book) return;
  saveProduct(applyOverride(book, override));
}

export function updateStock(bookId: string, stock: number) {
  const book = getLiveBook(bookId);
  if (!book) return;
  const qty = Math.max(0, Math.floor(stock));
  saveProduct({ ...book, stock: qty, stockStatus: qty > 0 ? "in_stock" : "out_of_stock" });
}

export function adjustStock(bookId: string, delta: number) {
  const book = getLiveBook(bookId);
  if (!book) return;
  updateStock(bookId, book.stock + delta);
}

export function restockProduct(bookId: string, add: number) {
  const book = getLiveBook(bookId);
  if (!book) return book;
  updateStock(bookId, book.stock + Math.max(0, Math.floor(add)));
  return getLiveBook(bookId);
}

/** Takes the ordered units out of stock once per order. */
export function commitStockForOrder(order: Pick<Order, "items" | "stockCommitted">) {
  if (order.stockCommitted) return false;
  for (const item of order.items) adjustStock(item.bookId, -item.quantity);
  return true;
}

/** Puts the units back, for cancelled orders that were never shipped. */
export function releaseStockForOrder(order: Pick<Order, "items" | "stockCommitted">) {
  if (!order.stockCommitted) return false;
  for (const item of order.items) adjustStock(item.bookId, item.quantity);
  return true;
}

export function inventorySnapshot(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const book of getAllProducts()) map[book.id] = book.stock;
  return map;
}

/* ---------------- Codes ---------------- */

export function generateBarcode(prefix = "890") {
  const body = prefix + Math.floor(Math.random() * 9000000000).toString().padStart(9, "0");
  const digits = body.slice(0, 12);
  const sum = digits.split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return digits + String((10 - (sum % 10)) % 10);
}

/** SKU like VGMF-CLI-0007: category prefix and the next free running number. */
export function generateSku(category: string, ignoreId?: string) {
  const prefix = (category.replace(/[^a-z]/gi, "").slice(0, 3) || "GEN").toUpperCase();
  const used = new Set(getAllProducts().filter((book) => book.id !== ignoreId).map((book) => book.sku?.toUpperCase()));
  let n = getAllProducts().length + 1;
  let sku = "";
  do sku = `VGMF-${prefix}-${String(n++).padStart(4, "0")}`;
  while (used.has(sku));
  return sku;
}

/** Unique 10-digit numeric product code. */
export function generateProductCode(ignoreId?: string) {
  const used = new Set(getAllProducts().filter((book) => book.id !== ignoreId).map((book) => book.productCode));
  let code = "";
  do code = String(Math.floor(1000000000 + Math.random() * 9000000000));
  while (used.has(code));
  return code;
}

export function isSkuTaken(sku: string, ignoreId?: string) {
  const value = sku.trim().toUpperCase();
  return getAllProducts().some((book) => book.id !== ignoreId && book.sku?.toUpperCase() === value);
}

export function isProductCodeTaken(code: string, ignoreId?: string) {
  return getAllProducts().some((book) => book.id !== ignoreId && book.productCode === code.trim());
}

/* ---------------- Categories ---------------- */

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function getCategories(): AdminCategory[] {
  const stored = readJSON<AdminCategory[]>(CATS_KEY, []);
  const names = new Set(stored.map((category) => category.name.toLowerCase()));
  const derived: AdminCategory[] = [];
  for (const book of [...books, ...getCustomBooks()]) {
    if (!book.category || names.has(book.category.toLowerCase())) continue;
    names.add(book.category.toLowerCase());
    derived.push({ id: slug(book.category), name: book.category, slug: slug(book.category), sortOrder: stored.length + derived.length, active: true });
  }
  return [...stored, ...derived].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
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

/* ---------------- Back-in-stock alerts ---------------- */

export type StockAlert = { id: string; bookId: string; email: string; name?: string; createdAt: string; notifiedAt?: string };

export function getStockAlerts(bookId?: string) {
  const all = readJSON<StockAlert[]>(ALERTS_KEY, []);
  return bookId ? all.filter((alert) => alert.bookId === bookId) : all;
}

export function pendingStockAlerts(bookId: string) {
  return getStockAlerts(bookId).filter((alert) => !alert.notifiedAt);
}

export function addStockAlert(bookId: string, email: string, name?: string) {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Enter a valid email address.");
  const all = getStockAlerts();
  if (all.some((alert) => alert.bookId === bookId && alert.email === value && !alert.notifiedAt)) return false;
  writeJSON(ALERTS_KEY, [{ id: `SA${Date.now()}`, bookId, email: value, name, createdAt: new Date().toISOString() }, ...all]);
  return true;
}

export function notifyBackInStock(book: Book) {
  const all = getStockAlerts();
  const pending = all.filter((alert) => alert.bookId === book.id && !alert.notifiedAt);
  if (!pending.length) return 0;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const now = new Date().toISOString();
  for (const alert of pending) {
    queueNotification({
      to: alert.email,
      name: alert.name,
      params: [alert.name ?? "Reader", book.title],
      subject: `Back in stock: ${book.title}`,
      template: "back-in-stock",
      body: `Hello${alert.name ? ` ${alert.name}` : ""},\n\n${book.title} is back in stock at the VGMF store.\n\nPrice: ₹${book.price.toLocaleString("en-IN")}\nOrder here: ${origin}/shop/${book.slug}\n\nStock is limited, so order soon.\n\n– VGMF Store`,
    });
    pushInbox({
      audience: "customer",
      email: alert.email,
      kind: "stock",
      title: `${book.title} is back in stock`,
      body: `It is available again in the Foundation shop. Price ₹${book.price.toLocaleString("en-IN")}.`,
      href: `/shop/${book.slug}`,
    });
  }
  writeJSON(ALERTS_KEY, all.map((alert) => (pending.some((item) => item.id === alert.id) ? { ...alert, notifiedAt: now } : alert)));
  return pending.length;
}
