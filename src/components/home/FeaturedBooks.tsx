import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import BookCard from "@/components/books/BookCard";
import { books as defaultBooks } from "@/data/books";

export default function FeaturedBooks({ books = defaultBooks }: { books?: typeof defaultBooks }) {
  const featured = books.slice(0, 5);

  return (
    <section className="section bg-white" aria-labelledby="books-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Shop"
          title="Shop & Publications"
          description="Clinical references, scholarly works and the writings of Vaidya R. B. Gogate. Order online with secure payments."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
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