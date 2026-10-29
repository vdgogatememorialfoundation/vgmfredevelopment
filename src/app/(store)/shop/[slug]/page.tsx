import type { Metadata } from "next";
import ShopProduct from "@/components/store/ShopProduct";
import { books } from "@/data/books";

export const dynamicParams = true;

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return books.map((book) => ({ slug: book.slug }));
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = books.find((item) => item.slug === slug);
  if (!book) return { title: "Shop" };
  return { title: book.title, description: book.description };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  return <ShopProduct slug={slug} />;
}
