import type { Metadata } from "next";
import { articles } from "@/data/articles";
import { ArticleView } from "@/components/articles/LiveArticles";
import { readMobileFeed } from "@/lib/server/mobile-feed";

interface ArticleDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: ArticleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) return { title: "Article" };
  return { title: article.title, description: article.excerpt };
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;
  const initial = (readMobileFeed().articles ?? []).find((item) => item.slug === slug) ?? null;
  return <ArticleView slug={slug} initial={initial} />;
}
