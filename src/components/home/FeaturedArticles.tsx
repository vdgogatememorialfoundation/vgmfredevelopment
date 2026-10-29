"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import ArticleCard from "@/components/articles/ArticleCard";
import { useLiveArticles } from "@/lib/use-cms";

export default function FeaturedArticles() {
  const articles = useLiveArticles();
  const featured = articles.filter((article) => article.featured);
  const shown = (featured.length > 0 ? featured : articles).slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <section className="section" aria-labelledby="articles-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Articles"
          title="From our journal"
          description="Perspectives on Ayurveda, education and the Foundation's work."
          action={
            <Link href="/articles" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
              View all
            </Link>
          }
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>

        <div className="mt-8">
          <Link href="/articles" className="btn-outline">
            View all articles
          </Link>
        </div>
      </div>
    </section>
  );
}