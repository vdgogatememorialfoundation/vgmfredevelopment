"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import ArticleCard from "@/components/articles/ArticleCard";
import { useLiveArticles } from "@/lib/use-cms";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function FeaturedArticles() {
  const articles = useLiveArticles();
  const { t } = useI18n();
  const featured = articles.filter((article) => article.featured);
  const shown = (featured.length > 0 ? featured : articles).slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <section className="section" aria-labelledby="articles-heading">
      <div className="container">
        <SectionHeading
          eyebrow={t("home.articlesEyebrow")}
          title={t("home.articlesTitle")}
          description={t("home.articlesDesc")}
          action={
            <Link href="/articles" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
              {t("common.viewAll")}
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
            {t("home.viewArticles")}
          </Link>
        </div>
      </div>
    </section>
  );
}