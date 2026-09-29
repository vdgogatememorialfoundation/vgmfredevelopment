import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import BookCard from "@/components/books/BookCard";
import RequireAuth from "@/components/auth/RequireAuth";
import DisplayBanner from "@/components/banners/DisplayBanner";
import { getBanners, getProducts } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Shop books and publications from Vaidya Gogate Memorial Foundation, including clinical references, scholarly works and the writings of Vaidya R. B. Gogate.",
};

export default async function ShopPage() {
  const [books, banners] = await Promise.all([getProducts(), getBanners("shop-top")]);
  return (
    <RequireAuth message="Sign in to browse the Foundation shop and order publications.">
      <main>
        <PageHeader
          eyebrow="Shop"
          title="Foundation Shop"
          description="Clinical references, scholarly works and the classic writings of Vaidya R. B. Gogate. Order online and have deliveries shipped to your address."
        />

        <DisplayBanner banner={banners[0]} compact />

        <section className="section bg-background">
          <div className="container">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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