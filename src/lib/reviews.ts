import { useSyncExternalStore } from "react";
import { subscribeCms } from "@/lib/cms";
import { isSampleOrder } from "@/lib/order-pipeline";
import { getOrders } from "@/lib/store";
import type { Review, SeminarReview } from "@/types";

export type { SeminarReview };

export type ProductReview = Review & {
  productId: string;
  email: string;
  verified: boolean;
  hidden?: boolean;
  reply?: { text: string; date: string; author?: string };
};

const SEMINAR_KEY = "vgmf_seminar_reviews";
const PRODUCT_KEY = "vgmf_product_reviews";

export const defaultSeminarReviews: SeminarReview[] = [
  {
    id: "sem-default-1",
    name: "Dr. Meera Kulkarni",
    event: "Manas Rog seminar, Pune",
    rating: 5,
    text: "The clinical discussion was clear and close to practice. I left with methods I could use the next week.",
    date: "2026-10-12",
    published: true,
  },
  {
    id: "sem-default-2",
    name: "Vd. Anil Joshi",
    event: "Autism Awareness Programme",
    rating: 5,
    text: "A thoughtful programme. The faculty stayed with questions until they were answered.",
    date: "2026-09-20",
    published: true,
  },
];

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

function stamp() {
  return new Date().toISOString();
}

export function getSeminarReviews(): SeminarReview[] {
  const stored = readJSON<SeminarReview[] | null>(SEMINAR_KEY, null);
  const rows = stored && stored.length ? stored : defaultSeminarReviews;
  return [...rows].sort((a, b) => b.date.localeCompare(a.date));
}

export function getPublishedSeminarReviews(): SeminarReview[] {
  return getSeminarReviews().filter((item) => item.published !== false && item.text.trim());
}

function postReview(body: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  void fetch("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

function patchReview(body: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  void fetch("/api/reviews", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export async function hydrateReviewsFromServer() {
  if (typeof window === "undefined") return;
  try {
    const response = await fetch("/api/reviews", { cache: "no-store", credentials: "same-origin" });
    const data = (await response.json()) as {
      ok?: boolean;
      allSeminarReviews?: SeminarReview[];
      allProductReviews?: ProductReview[];
    };
    if (!data.ok) return;
    if (data.allSeminarReviews?.length) replaceSeminarReviews(data.allSeminarReviews);
    if (data.allProductReviews?.length) replaceProductReviews(data.allProductReviews);
  } catch {
    /* keep local copy */
  }
}

export function saveSeminarReview(input: Partial<SeminarReview> & Pick<SeminarReview, "name" | "text">) {
  const current = getSeminarReviews();
  const id = input.id?.trim() || `seminar-${Date.now()}`;
  const next: SeminarReview = {
    id,
    name: input.name.trim(),
    event: input.event?.trim() || "Seminar",
    rating: Math.min(5, Math.max(1, Math.round(input.rating ?? 5))),
    text: input.text.trim(),
    date: input.date || stamp(),
    photo: input.photo?.trim() || undefined,
    published: input.published !== false,
  };
  writeJSON(SEMINAR_KEY, [next, ...current.filter((item) => item.id !== id)]);
  postReview({ kind: "seminar", ...next });
  return next;
}

export function deleteSeminarReview(id: string) {
  writeJSON(SEMINAR_KEY, getSeminarReviews().filter((item) => item.id !== id));
  patchReview({ id, kind: "seminar", remove: true });
}

export function replaceSeminarReviews(rows: SeminarReview[]) {
  writeJSON(SEMINAR_KEY, rows);
}

export function getProductReviews(): ProductReview[] {
  return readJSON<ProductReview[]>(PRODUCT_KEY, []).sort((a, b) => b.date.localeCompare(a.date));
}

export function listProductReviews(productId: string, includeHidden = false): ProductReview[] {
  return getProductReviews().filter((item) => item.productId === productId && (includeHidden || !item.hidden));
}

export function hasPurchasedProduct(email: string | undefined, userId: string | undefined, bookId: string) {
  if (!email && !userId) return false;
  const mail = email?.trim().toLowerCase() || "";
  return getOrders().some((order) => {
    if (isSampleOrder(order)) return false;
    if (order.status === "Cancelled" || order.status === "Failed") return false;
    if (order.paymentStatus === "Failed" || order.paymentStatus === "Refunded") return false;
    if (!order.items.some((item) => item.bookId === bookId)) return false;
    const orderEmail = order.deliveryAddress?.email?.trim().toLowerCase() || "";
    return Boolean((mail && (orderEmail === mail || order.userId?.toLowerCase() === mail)) || (userId && order.userId === userId));
  });
}

export function findProductReview(productId: string, email: string) {
  const value = email.trim().toLowerCase();
  return getProductReviews().find((item) => item.productId === productId && item.email.toLowerCase() === value);
}

export function saveProductReview(input: {
  id?: string;
  productId: string;
  name: string;
  email: string;
  rating: number;
  text: string;
  verified?: boolean;
  hidden?: boolean;
  reply?: ProductReview["reply"];
}) {
  const current = getProductReviews();
  const email = input.email.trim().toLowerCase();
  const existing = input.id
    ? current.find((item) => item.id === input.id)
    : current.find((item) => item.productId === input.productId && item.email.toLowerCase() === email);
  const next: ProductReview = {
    id: existing?.id || input.id || `prev-${Date.now()}`,
    productId: input.productId,
    name: input.name.trim(),
    email,
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    date: existing?.date || stamp(),
    text: input.text.trim(),
    verified: input.verified ?? existing?.verified ?? true,
    hidden: input.hidden ?? existing?.hidden ?? false,
    reply: input.reply ?? existing?.reply,
  };
  writeJSON(
    PRODUCT_KEY,
    [next, ...current.filter((item) => item.id !== next.id)]
  );
  postReview({ kind: "product", ...next });
  return next;
}

export function replyToProductReview(id: string, text: string, author = "Foundation") {
  const current = getProductReviews();
  const found = current.find((item) => item.id === id);
  if (!found) return null;
  const saved = saveProductReview({
    ...found,
    reply: { text: text.trim(), date: stamp(), author },
  });
  patchReview({ id, reply: text.trim(), author });
  return saved;
}

export function hideProductReview(id: string, hidden: boolean) {
  const found = getProductReviews().find((item) => item.id === id);
  if (!found) return null;
  const saved = saveProductReview({ ...found, hidden });
  patchReview({ id, hidden });
  return saved;
}

export function deleteProductReview(id: string) {
  writeJSON(PRODUCT_KEY, getProductReviews().filter((item) => item.id !== id));
  patchReview({ id, kind: "product", remove: true });
}

export function replaceProductReviews(rows: ProductReview[]) {
  writeJSON(PRODUCT_KEY, rows);
}

export function averageRating(reviews: Array<{ rating: number }>) {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length;
}

let seminarRaw = "\0";
let seminarList: SeminarReview[] = [];
let productRaw = "\0";
let productList: ProductReview[] = [];

export function usePublishedSeminarReviews() {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = window.localStorage.getItem(SEMINAR_KEY) ?? "";
      if (raw === seminarRaw) return seminarList;
      seminarRaw = raw;
      seminarList = getPublishedSeminarReviews();
      return seminarList;
    },
    () => []
  );
}

export function useProductReviews(productId: string) {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = window.localStorage.getItem(PRODUCT_KEY) ?? "";
      const token = `${productId}|${raw}`;
      if (token === productRaw) return productList;
      productRaw = token;
      productList = listProductReviews(productId);
      return productList;
    },
    () => []
  );
}

let allProductRaw = "\0";
let allProductList: ProductReview[] = [];
let allSeminarRaw = "\0";
let allSeminarList: SeminarReview[] = [];

export function useAllSeminarReviews() {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = window.localStorage.getItem(SEMINAR_KEY) ?? "";
      if (raw === allSeminarRaw) return allSeminarList;
      allSeminarRaw = raw;
      allSeminarList = getSeminarReviews();
      return allSeminarList;
    },
    () => []
  );
}

export function useAllProductReviews() {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = window.localStorage.getItem(PRODUCT_KEY) ?? "";
      if (raw === allProductRaw) return allProductList;
      allProductRaw = raw;
      allProductList = getProductReviews();
      return allProductList;
    },
    () => []
  );
}
