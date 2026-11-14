import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";
import type { Review, SeminarReview } from "@/types";

export type StoredProductReview = Review & {
  productId: string;
  email: string;
  verified: boolean;
  media?: { url: string; kind: "image" | "video" }[];
};

type Store = {
  seminarReviews: SeminarReview[];
  productReviews: StoredProductReview[];
};

const FILE = () => dataFile("reviews.json");

function read(): Store {
  try {
    const parsed = JSON.parse(readFileSync(FILE(), "utf8")) as Partial<Store>;
    return {
      seminarReviews: Array.isArray(parsed.seminarReviews) ? parsed.seminarReviews : [],
      productReviews: Array.isArray(parsed.productReviews) ? parsed.productReviews : [],
    };
  } catch {
    return { seminarReviews: [], productReviews: [] };
  }
}

function write(store: Store) {
  writeFileSync(FILE(), JSON.stringify(store, null, 2));
  return store;
}

export function listReviews() {
  return read();
}

export function upsertSeminarReview(input: SeminarReview) {
  const store = read();
  const next = [input, ...store.seminarReviews.filter((item) => item.id !== input.id)];
  return write({ ...store, seminarReviews: next });
}

export function removeSeminarReview(id: string) {
  const store = read();
  return write({ ...store, seminarReviews: store.seminarReviews.filter((item) => item.id !== id) });
}

export function upsertProductReview(input: StoredProductReview) {
  const store = read();
  const next = [input, ...store.productReviews.filter((item) => item.id !== input.id && !(item.productId === input.productId && item.email.toLowerCase() === input.email.toLowerCase()))];
  return write({ ...store, productReviews: next });
}

export function replyProductReview(id: string, text: string, author = "Foundation") {
  const store = read();
  const next = store.productReviews.map((item) =>
    item.id === id ? { ...item, reply: { text, date: new Date().toISOString(), author } } : item
  );
  return write({ ...store, productReviews: next });
}

export function hideProductReview(id: string, hidden: boolean) {
  const store = read();
  const next = store.productReviews.map((item) => (item.id === id ? { ...item, hidden } : item));
  return write({ ...store, productReviews: next });
}

export function removeProductReview(id: string) {
  const store = read();
  return write({ ...store, productReviews: store.productReviews.filter((item) => item.id !== id) });
}
