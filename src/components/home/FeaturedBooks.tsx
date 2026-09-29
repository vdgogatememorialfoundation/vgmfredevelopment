import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import BookCard from "@/components/books/BookCard";
import { books } from "@/data/books";

export default function FeaturedBooks() {
  const featured = books.slice(0, 3);

  return (
    <section className="section bg-background" aria-labelledby="books-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Shop"
          title="Shop & Publications"
          description="Clinical references, scholarly works and the writings of Vaidya R. B. Gogate. Order online with secure payments."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/shop" className="btn-primary">
            Explore the Shop
          </Link>
        </div>
      </div>
    </section>
  );
}