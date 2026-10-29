import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/locales";
import { siteConfig } from "@/lib/constants";

export function isArticlePublished(article: Article) {
  return (article.status ?? "published") === "published";
}

export function localizedArticle(article: Article, locale: Locale): Article {
  if (locale === "en") return article;
  const copy = article.translations?.[locale];
  if (!copy) return article;
  return {
    ...article,
    title: copy.title?.trim() || article.title,
    excerpt: copy.excerpt?.trim() || article.excerpt,
    content: copy.content?.trim() || article.content,
  };
}

export function articlePublicPath(article: Pick<Article, "slug">) {
  return `/articles/${article.slug}`;
}

export function articlePublicUrl(article: Pick<Article, "slug">) {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${articlePublicPath(article)}`;
  }
  return `${siteConfig.url}${articlePublicPath(article)}`;
}

export function articleShareText(article: Article) {
  const url = articlePublicUrl(article);
  const blurb = (article.excerpt || article.title).replace(/\s+/g, " ").trim();
  return `${article.title}\n\n${blurb}\n\n${url}`;
}
