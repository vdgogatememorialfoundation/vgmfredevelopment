import type { Book, Order } from "@/types";

export type ItemTotals = {
  orders: number;
  total: number;
  books: number;
  languages: [string, number][];
  others: [string, number][];
};

const byCount = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]);

/** Units across orders (cancelled ones left out): books split by language, other products listed apart. `keep` limits which items count. */
export function itemTotals(
  orders: Order[],
  findBook: (id: string) => Book | undefined,
  keep: (book: Book | undefined) => boolean = () => true
): ItemTotals {
  let total = 0;
  let books = 0;
  let counted = 0;
  const languages = new Map<string, number>();
  const others = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "Cancelled") continue;
    counted += 1;
    for (const item of order.items) {
      const book = findBook(item.bookId);
      if (!keep(book)) continue;
      const quantity = Number(item.quantity) || 0;
      total += quantity;
      if (book?.productType === "other") {
        others.set(item.title, (others.get(item.title) ?? 0) + quantity);
        continue;
      }
      books += quantity;
      const language = book?.language?.trim() || "Unspecified";
      languages.set(language, (languages.get(language) ?? 0) + quantity);
    }
  }
  return { orders: counted, total, books, languages: byCount(languages), others: byCount(others) };
}
