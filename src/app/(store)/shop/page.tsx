import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import BookCard from "@/components/books/BookCard";
import RequireAuth from "@/components/auth/RequireAuth";
import { books } from "@/data/books";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Shop books and publications from Vaidya Gogate Memorial Foundation, including clinical references, scholarly works and the writings of Vaidya R. B. Gogate.",
};

export default function ShopPage() {
  return (
    <RequireAuth message="Sign in to browse the Foundation shop and order publications.">
      <main>
        <PageHeader
          eyebrow="Shop"
          title="Foundation Shop"
          description="Clinical references, scholarly works and the classic writings of Vaidya R. B. Gogate. Order online and have deliveries shipped to your address."
        />

        <section className="section bg-background">
          <div className="container">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </RequireAuth>
  );
}