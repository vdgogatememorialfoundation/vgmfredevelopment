import { books } from "@/data/books";
import type { AdminCategory, Book, Order, ProductOverride } from "@/types";
import { logAudit } from "@/lib/audit";
import { queueNotification } from "@/lib/notify";
import { pushInbox } from "@/lib/inbox";
import { stockLabelCode, stripUnitSuffix } from "@/lib/barcode";
import { isPublishedNow } from "@/lib/schedule";

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

/** Pre-orders: expected release (or today, if none or already past) plus 10 days for packing and delivery. */
export function preorderDeliveryDate(book: Pick<Book, "preorder">, now = new Date()) {
  const release = book.preorder?.releaseDate ? new Date(`${book.preorder.releaseDate}T00:00:00+05:30`) : null;
  const start = release && !Number.isNaN(release.getTime()) && release > now ? release : now;
  const date = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function canOrder(book: Pick<Book, "stock" | "stockStatus" | "preorder">) {
  return isPurchasable(book) || canPreorder(book);
}

export function availabilityText(book: Pick<Book, "stock" | "stockStatus" | "preorder">) {
  if (isPurchasable(book)) return "In Stock";
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
let titleCache: { at: number; titles: Map<string, string> } | null = null;

/** The product's current name for an order line, so renamed products show their new name on orders. */
export function currentProductTitle(item: { bookId?: string; sku?: string; title: string }) {
  if (typeof window === "undefined") return item.title;
  if (!titleCache || Date.now() - titleCache.at > 5000) titleCache = { at: Date.now(), titles: new Map(getAllProducts().flatMap((book) => [[book.id, book.title], ...(book.sku ? [[`sku:${book.sku}`, book.title]] : [])] as [string, string][])) };
  return (item.bookId && titleCache.titles.get(item.bookId)) || (item.sku && titleCache.titles.get(`sku:${item.sku}`)) || item.title;
}

export function getLiveBooks(): Book[] {
  return getAllProducts().filter((book) => book.active !== false && isPublishedNow(book));
}

export function getLiveBook(id: string): Book | undefined {
  return getAllProducts().find((book) => book.id === id);
}

export function getLiveBookBySlug(slug: string): Book | undefined {
  return getLiveBooks().find((book) => book.slug === slug);
}

export function getProductByCode(code: string): Book | undefined {
  const value = stripUnitSuffix(code).toLowerCase();
  if (!value) return undefined;
  return getAllProducts().find((book) =>
    [book.productCode, book.sku, book.barcode, book.isbn?.replace(/-/g, ""), book.id]
      .filter(Boolean)
      .some((item) => String(item).toLowerCase() === value || String(item).toLowerCase() === value.replace(/-/g, ""))
  );
}

/** Saves a full product record. Sends back-in-stock emails when it becomes orderable from stock again. */
function uniqueSlug(base: string, id: string) {
  const taken = new Set(getLiveBooks().filter((item) => item.id !== id).map((item) => item.slug));
  let next = base;
  for (let index = 2; taken.has(next); index += 1) next = `${base}-${index}`;
  return next;
}

export function saveProduct(book: Book) {
  logAudit("Product saved", book.sku || book.id, book.title);
  const before = getLiveBook(book.id);
  // The link always follows the product name; old links are kept so they redirect.
  const wanted = slug(book.title);
  const follows = !wanted || book.slug === wanted || new RegExp(`^${wanted}-\\d+$`).test(book.slug);
  const nextSlug = follows ? book.slug : uniqueSlug(wanted, book.id);
  const oldSlugs = [before?.slug, book.slug].filter((old): old is string => Boolean(old) && old !== nextSlug);
  const previousSlugs = oldSlugs.length ? Array.from(new Set([...(book.previousSlugs ?? []), ...oldSlugs])).filter((old) => old !== nextSlug) : book.previousSlugs;
  const record = normalize({
    ...book,
    slug: nextSlug,
    previousSlugs,
    barcode: book.barcode?.trim() || generateBarcode(),
    createdAt: book.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
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
  logAudit("Product deleted", id);
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

/** Reserves `count` new numbered stock labels for a product and returns their codes. */
export function issueStockLabels(bookId: string, count: number) {
  const book = getLiveBook(bookId);
  if (!book) return [];
  const total = Math.max(1, Math.min(500, Math.floor(count) || 1));
  const base = book.productCode || book.barcode || book.sku || book.id;
  const start = Math.max(1, book.stockLabelNext ?? 1);
  const codes = Array.from({ length: total }, (_, index) => stockLabelCode(base, start + index));
  saveProduct({ ...book, stockLabelNext: start + total });
  return codes;
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
  const used = new Set(getAllProducts().map((book) => book.barcode).filter(Boolean));
  let code = "";
  do {
    const body = prefix + Math.floor(Math.random() * 9000000000).toString().padStart(9, "0");
    const digits = body.slice(0, 12);
    const sum = digits.split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    code = digits + String((10 - (sum % 10)) % 10);
  } while (used.has(code));
  return code;
}

export function ensureProductBarcodes() {
  let changed = 0;
  for (const book of getAllProducts()) {
    if (book.barcode?.trim()) continue;
    saveProduct({ ...book, barcode: generateBarcode() });
    changed += 1;
  }
  return changed;
}

/** SKU like VGMF-CLI-0007: category prefix and the next free running number. */
/** Unique 10-digit numeric SKU. */
export function generateSku(_category?: string, ignoreId?: string) {
  void _category;
  const used = new Set(getAllProducts().filter((book) => book.id !== ignoreId).flatMap((book) => [book.sku, book.productCode]));
  let sku = "";
  do sku = String(Math.floor(1000000000 + Math.random() * 9000000000));
  while (used.has(sku));
  return sku;
}

/** Numeric batch number: date (YYMMDD) and a 3-digit serial. */
export function generateBatchNo() {
  const day = new Intl.DateTimeFormat("en-GB", { year: "2-digit", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" })
    .format(new Date())
    .split("/")
    .reverse()
    .join("");
  const used = new Set(getAllProducts().map((book) => book.batchNo));
  let batch = "";
  do batch = `${day}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  while (used.has(batch));
  return batch;
}

/** Batch number for an order line: the one saved on the order, else the product's current batch. */
export function orderItemBatch(item: { bookId?: string; batchNo?: string }) {
  return item.batchNo || (item.bookId ? getAllProducts().find((book) => book.id === item.bookId)?.batchNo : "") || "";
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
      body: `Dear${alert.name ? ` ${alert.name}` : " Guest"},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\n${book.title} is back in stock at the Foundation shop.\n\nPrice: ₹${book.price.toLocaleString("en-IN")}\nOrder here: ${origin}/shop/${book.slug}\n\nStock is limited, so order soon.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
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
