"use client";

import PageHeader from "@/components/common/PageHeader";
import BookCard from "@/components/books/BookCard";
import { useLiveBooks } from "@/lib/use-cms";

export default function ShopPage() {
  const books = useLiveBooks();

  return (
    <main>
      <PageHeader
        eyebrow="Shop"
        title="Foundation Shop"
        description="Clinical references, scholarly works and the writings of Vaidya R. B. Gogate. Browse freely — sign in or register to place an order."
      />

      <section className="section bg-background">
        <div className="container">
          {books.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-muted">
              No products are listed yet.
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
