"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import BookCard from "@/components/books/BookCard";
import { useLiveBooks } from "@/lib/use-cms";
import { useI18n } from "@/components/i18n/LanguageProvider";
import type { Book } from "@/types";

type SortId = "title" | "price-asc" | "price-desc" | "newest";

const PRODUCT_KEYS = ["vgmf_custom_books", "vgmf_deleted_books", "vgmf_admin_products"];

export function browserHasProductEdits() {
  return PRODUCT_KEYS.some((key) => window.localStorage.getItem(key));
}

export default function ShopCatalogue({ initialBooks }: { initialBooks: Book[] }) {
  const live = useLiveBooks();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [language, setLanguage] = useState("all");
  const [stock, setStock] = useState("all");
  const [sort, setSort] = useState<SortId>("title");
  const [useLocal, setUseLocal] = useState(false);

  useEffect(() => {
    if (browserHasProductEdits()) setUseLocal(true);
  }, [live]);

  const books = useLocal ? live : initialBooks;

  const categories = useMemo(
    () => [...new Set(books.map((book) => book.category).filter(Boolean))].sort(),
    [books]
  );
  const languages = useMemo(
    () => [...new Set(books.map((book) => book.language).filter(Boolean) as string[])].sort(),
    [books]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = books.filter((book) => {
      if (book.active === false) return false;
      if (category !== "all" && book.category !== category) return false;
      if (language !== "all" && book.language !== language) return false;
      if (stock === "in" && book.stockStatus === "out_of_stock") return false;
      if (stock === "out" && book.stockStatus !== "out_of_stock") return false;
      if (!q) return true;
      return [book.title, book.author, book.category, book.language, book.sku, book.isbn]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
    return list.sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "newest") return (b.publishedYear ?? 0) - (a.publishedYear ?? 0);
      return a.title.localeCompare(b.title);
    });
  }, [books, query, category, language, stock, sort]);

  return (
    <main>
      <PageHeader eyebrow={t("shop.eyebrow")} title={t("shop.title")} description={t("shop.desc")} />
      <section className="section bg-background">
        <div className="container">
          <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title or author"
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
              aria-label="Search the shop"
            />
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" aria-label="Category">
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" aria-label="Language">
              <option value="all">All languages</option>
              {languages.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={stock} onChange={(event) => setStock(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" aria-label="Availability">
              <option value="all">All stock</option>
              <option value="in">In stock</option>
              <option value="out">Out of stock</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortId)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm" aria-label="Sort">
              <option value="title">Title</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <p className="mb-4 text-xs text-text-muted">{shown.length} publication{shown.length === 1 ? "" : "s"}</p>
          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-muted">
              {books.length === 0 ? t("shop.empty") : "No publications match these filters."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
