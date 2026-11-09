import type { Metadata } from "next";
import ShopProduct from "@/components/store/ShopProduct";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { isPublishedNow } from "@/lib/schedule";

export const dynamic = "force-dynamic";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = (readMobileFeed().books ?? []).find((item) => item.slug === slug && item.active !== false && isPublishedNow(item));
  if (!book) return { title: "Shop" };
  return { title: book.title, description: book.description };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const books = (readMobileFeed().books ?? []).filter((book) => book.active !== false && isPublishedNow(book));
  const book = books.find((item) => item.slug === slug) ?? null;
  return <ShopProduct slug={slug} initialBook={book} initialBooks={books} />;
}
