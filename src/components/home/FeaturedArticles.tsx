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
    <section className="section bg-white" aria-labelledby="articles-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Articles"
          title="From Our Journal"
          description="Perspectives on Ayurveda, research, education and the Foundation's work."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/articles" className="btn-outline">
            View All Articles
          </Link>
        </div>
      </div>
    </section>
  );
}