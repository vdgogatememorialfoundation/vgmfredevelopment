import type { Book } from "@/types";

export type ParcelDims = { length: number; breadth: number; height: number };

/**
 * Tentative parcel from each product's own weight and packed size, used for quotes until the packed parcel is entered.
 * Copies are stacked: heights add up, the largest length and breadth win. No size is returned unless every product has one.
 */
export function itemsParcel(
  items: { bookId: string; quantity: number }[],
  findBook: (id: string) => Pick<Book, "weightKg" | "packCm"> | undefined,
  defaultWeightKg: number
): { weightKg: number; dims?: ParcelDims } {
  let weight = 0;
  let length = 0;
  let breadth = 0;
  let height = 0;
  let sized = items.length > 0;
  for (const item of items) {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const book = findBook(item.bookId);
    const kg = Number(book?.weightKg);
    weight += (kg > 0 ? kg : defaultWeightKg) * quantity;
    const cm = book?.packCm;
    if (cm && cm.length > 0 && cm.breadth > 0 && cm.height > 0) {
      length = Math.max(length, cm.length);
      breadth = Math.max(breadth, cm.breadth);
      height += cm.height * quantity;
    } else {
      sized = false;
    }
  }
  const weightKg = Math.round(weight * 1000) / 1000 || defaultWeightKg;
  return { weightKg, dims: sized && height > 0 ? { length, breadth, height: Math.round(height * 10) / 10 } : undefined };
}
