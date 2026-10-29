"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import BookCard from "@/components/books/BookCard";
import { useLiveBooks } from "@/lib/use-cms";

export default function FeaturedBooks() {
  const featured = useLiveBooks().filter((book) => book.active !== false).slice(0, 4);

  return (
    <section className="section" aria-labelledby="books-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Shop"
          title="Shop & publications"
          description="Clinical references, scholarly works and the writings of Vaidya R. B. Gogate."
          action={
            <Link href="/shop" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
              View shop
            </Link>
          }
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </section>
  );
}