"use client";

import Link from "next/link";
import type { Article } from "@/types";
import Badge from "@/components/common/Badge";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function ArticleCard({ article }: { article: Article }) {
  const { t } = useI18n();
  return (
    <article className="card flex flex-col overflow-hidden">
      {article.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : (
        article.featured && (
          <MediaPlaceholder variant="article" label={article.title} aspectClassName="aspect-[16/9]" />
        )
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="burgundy">{article.category}</Badge>
          <time className="text-sm text-text-muted" dateTime={article.date}>
            {formatDate(article.date)}
          </time>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-text-primary leading-snug">
          <Link
            href={`/articles/${article.slug}`}
            className="transition hover:text-burgundy"
          >
            {article.title}
          </Link>
        </h3>

        <p className="mt-2 text-sm text-text-muted line-clamp-3">
          {article.excerpt}
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between text-sm">
          {article.author && (
            <span className="text-text-muted">{t("article.publishedBy")} {article.author}</span>
          )}
          <Link
            href={`/articles/${article.slug}`}
            className="inline-flex items-center gap-1.5 font-semibold text-burgundy transition hover:text-burgundy-dark"
          >
            Read
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}