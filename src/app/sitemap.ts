import type { MetadataRoute } from "next";
import { publicSitemapPaths, siteUrl } from "@/lib/seo";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { isPublishedNow } from "@/lib/schedule";
import { articles as seedArticles } from "@/data/articles";
import { clinics as seedClinics } from "@/data/clinics";

export const dynamic = "force-dynamic";

function stamp(value?: string) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time) : new Date();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const feed = readMobileFeed();
  const entries: MetadataRoute.Sitemap = publicSitemapPaths.map((path, index) => ({
    url: `${siteUrl}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === "/" || path === "/articles" || path === "/shop" ? "daily" : "monthly",
    priority: path === "/" ? 1 : index < 8 ? 0.8 : 0.5,
  }));
  const seen = new Set(entries.map((entry) => entry.url));
  const add = (path: string, modified: Date, priority: number, changeFrequency: "weekly" | "monthly" = "monthly") => {
    const url = `${siteUrl}${path}`;
    if (seen.has(url)) return;
    seen.add(url);
    entries.push({ url, lastModified: modified, changeFrequency, priority });
  };

  const articles = feed.articles?.length ? feed.articles : seedArticles;
  for (const article of articles) {
    if (!article.slug || (article.status && article.status !== "published") || !isPublishedNow(article)) continue;
    add(`/articles/${encodeURIComponent(article.slug)}`, stamp(article.date), 0.8);
  }
  for (const book of feed.books ?? []) {
    if (!book.slug || book.active === false || !isPublishedNow(book)) continue;
    add(`/shop/${encodeURIComponent(book.slug)}`, lastModified, 0.7, "weekly");
  }
  for (const event of feed.events ?? []) {
    if (!event.slug || !isPublishedNow(event)) continue;
    add(`/events/${encodeURIComponent(event.slug)}`, stamp(event.startDate), 0.7, "weekly");
  }
  const clinics = feed.clinics?.length ? feed.clinics : seedClinics;
  for (const clinic of clinics) {
    if (clinic.slug) add(`/clinics/${encodeURIComponent(clinic.slug)}`, lastModified, 0.6);
  }
  return entries;
}
