import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import ShopProduct from "@/components/store/ShopProduct";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { isPublishedNow } from "@/lib/schedule";
import { siteConfig } from "@/lib/constants";
import { absoluteUrl, breadcrumbJsonLd, plainText } from "@/lib/seo";
import { StructuredData } from "@/components/seo/StructuredData";

export const dynamic = "force-dynamic";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = (readMobileFeed().books ?? []).find((item) => item.slug === slug && item.active !== false && isPublishedNow(item));
  if (!book) return { title: "Shop" };
  const description = plainText(book.description);
  const url = absoluteUrl(`/shop/${book.slug}`);
  const images = book.coverImage ? [{ url: absoluteUrl(book.coverImage), alt: book.title }] : undefined;
  return {
    title: book.language ? `${book.title} (${book.language})` : book.title,
    description,
    keywords: [book.title, book.author, book.language, "Ayurveda books", siteConfig.name].filter((word): word is string => Boolean(word)),
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: book.title, description, siteName: siteConfig.name, ...(images ? { images } : {}) },
    twitter: { card: images ? "summary_large_image" : "summary", title: book.title, description, ...(images ? { images: images.map((image) => image.url) } : {}) },
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const books = (readMobileFeed().books ?? []).filter((book) => book.active !== false && isPublishedNow(book));
  const book = books.find((item) => item.slug === slug) ?? null;
  if (!book) {
    const renamed = books.find((item) => Array.isArray(item.previousSlugs) && (item.previousSlugs as string[]).includes(slug));
    if (renamed?.slug) permanentRedirect(`/shop/${renamed.slug}`);
  }
  return (
    <>
      {book && (
        <StructuredData
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Product",
              name: book.title,
              description: plainText(book.description, 500),
              image: book.coverImage ? [absoluteUrl(book.coverImage)] : undefined,
              sku: book.sku || book.productCode,
              gtin13: book.isbn && /^\d{13}$/.test(book.isbn.replace(/-/g, "")) ? book.isbn.replace(/-/g, "") : undefined,
              brand: { "@type": "Brand", name: siteConfig.name },
              inLanguage: book.language,
              offers: {
                "@type": "Offer",
                url: absoluteUrl(`/shop/${book.slug}`),
                price: book.price,
                priceCurrency: book.currency || "INR",
                availability:
                  book.stock > 0
                    ? "https://schema.org/InStock"
                    : book.preorder?.enabled
                      ? "https://schema.org/PreOrder"
                      : "https://schema.org/OutOfStock",
                seller: { "@id": `${absoluteUrl("/")}#organization` },
              },
            },
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Shop", path: "/shop" },
              { name: book.title, path: `/shop/${book.slug}` },
            ]),
          ]}
        />
      )}
      <ShopProduct slug={slug} initialBook={book} initialBooks={books} />
    </>
  );
}
