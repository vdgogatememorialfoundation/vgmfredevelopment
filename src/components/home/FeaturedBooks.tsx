"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import BookCard from "@/components/books/BookCard";
import { useLiveBooks } from "@/lib/use-cms";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function FeaturedBooks() {
  const featured = useLiveBooks().filter((book) => book.active !== false).slice(0, 4);
  const { t } = useI18n();

  return (
    <section className="section-paper" aria-labelledby="books-heading">
      <div className="container">
        <SectionHeading
          eyebrow={t("home.shopEyebrow")}
          title={t("home.shopTitle")}
          description={t("home.shopDesc")}
          action={
            <Link href="/shop" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
              {t("home.viewShop")}
            </Link>
          }
        />

        {featured.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">
            {t("home.noBooks")}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}