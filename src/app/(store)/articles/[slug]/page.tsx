import type { Metadata } from "next";
import { articles } from "@/data/articles";
import { ArticleView } from "@/components/articles/LiveArticles";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { isPublishedNow } from "@/lib/schedule";
import { siteConfig } from "@/lib/constants";
import { absoluteUrl, breadcrumbJsonLd, plainText } from "@/lib/seo";
import { StructuredData } from "@/components/seo/StructuredData";
import type { Article } from "@/types";

export const revalidate = 300;

interface ArticleDetailPageProps {
  params: Promise<{ slug: string }>;
}

function findArticle(slug: string): Article | undefined {
  const live = (readMobileFeed().articles ?? []).find((item) => item.slug === slug && isPublishedNow(item));
  return live ?? articles.find((item) => item.slug === slug);
}

function authorName(article: Article) {
  const name = (article.author || "").trim();
  return !name || /\badmin\b|^vgmf$/i.test(name) ? siteConfig.name : name;
}

export async function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: ArticleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) return { title: "Article" };
  const description = plainText(article.excerpt || article.content);
  const path = `/articles/${article.slug}`;
  const images = article.coverImage ? [{ url: absoluteUrl(article.coverImage), alt: article.title }] : undefined;
  return {
    title: article.title,
    description,
    keywords: [article.category, ...(article.tags ?? []), "Ayurveda", siteConfig.name].filter(Boolean),
    authors: [{ name: authorName(article) }],
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      type: "article",
      url: absoluteUrl(path),
      title: article.title,
      description,
      siteName: siteConfig.name,
      publishedTime: article.date,
      authors: [authorName(article)],
      section: article.category,
      tags: article.tags,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: article.title,
      description,
      ...(images ? { images: images.map((image) => image.url) } : {}),
    },
  };
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;
  const initial = (readMobileFeed().articles ?? []).find((item) => item.slug === slug && isPublishedNow(item)) ?? null;
  const article = initial ?? articles.find((item) => item.slug === slug);
  return (
    <>
      {article && (
        <StructuredData
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: article.title.slice(0, 110),
              description: plainText(article.excerpt || article.content),
              datePublished: article.date,
              dateModified: article.date,
              articleSection: article.category,
              keywords: article.tags?.join(", "),
              image: article.coverImage ? [absoluteUrl(article.coverImage)] : undefined,
              author: { "@type": authorName(article) === siteConfig.name ? "Organization" : "Person", name: authorName(article) },
              publisher: { "@id": `${absoluteUrl("/")}#organization` },
              mainEntityOfPage: absoluteUrl(`/articles/${article.slug}`),
            },
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Articles", path: "/articles" },
              { name: article.title, path: `/articles/${article.slug}` },
            ]),
          ]}
        />
      )}
      <ArticleView slug={slug} initial={initial} />
    </>
  );
}
