"use client";

import PageHeader from "@/components/common/PageHeader";
import BookCard from "@/components/books/BookCard";
import { useLiveBooks } from "@/lib/use-cms";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function ShopPage() {
  const books = useLiveBooks();
  const { t } = useI18n();

  return (
    <main>
      <PageHeader eyebrow={t("shop.eyebrow")} title={t("shop.title")} description={t("shop.desc")} />
      <section className="section bg-background">
        <div className="container">
          {books.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-muted">
              {t("shop.empty")}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
