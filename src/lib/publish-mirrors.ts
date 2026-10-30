import { hideAnnouncement, hideNotice, saveAnnouncement, saveNotice } from "@/lib/cms";
import { isArticlePublished } from "@/lib/article-display";
import type { Announcement, Article, Event, Notice } from "@/types";

function dateOnly(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function postNotice(notice: Notice) {
  if (typeof window === "undefined") return;
  void fetch("/api/notices", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(notice),
  }).catch(() => undefined);
}

export function eventNoticeId(eventId: string) {
  return `ntc-event-${eventId}`;
}

export function articleNoticeId(articleId: string) {
  return `ntc-article-${articleId}`;
}

export function mirrorEvent(event: Event) {
  const title = event.name.trim();
  if (!title) return;
  const description =
    (event.shortDescription || event.description || `${title} has been added to the Foundation calendar.`).trim() ||
    `${title} has been added to the Foundation calendar.`;
  const href = `/events/${event.slug}`;
  const notice: Notice = {
    id: eventNoticeId(event.id),
    title,
    date: dateOnly(event.startDate),
    category: event.eventType || "Event",
    description,
    href,
    publishAt: event.publishAt,
    unpublishAt: event.unpublishAt,
  };
  const announcement: Announcement = {
    id: `ann-event-${event.id}`,
    title,
    description,
    date: notice.date,
    category: event.eventType || "Event",
    href,
    priority: "high",
    publishAt: event.publishAt,
    unpublishAt: event.unpublishAt,
  };
  saveNotice(notice);
  saveAnnouncement(announcement);
  postNotice(notice);
}

export function unmirrorEvent(eventId: string) {
  hideNotice(eventNoticeId(eventId));
  hideAnnouncement(`ann-event-${eventId}`);
}

export function unmirrorArticle(articleId: string) {
  hideNotice(articleNoticeId(articleId));
  hideAnnouncement(`ann-article-${articleId}`);
}

export function mirrorArticle(article: Article) {
  if (!isArticlePublished(article)) {
    hideNotice(articleNoticeId(article.id));
    hideAnnouncement(`ann-article-${article.id}`);
    return;
  }
  const title = article.title.trim();
  if (!title) return;
  const description = (article.excerpt || title).trim();
  const href = `/articles/${article.slug}`;
  const notice: Notice = {
    id: articleNoticeId(article.id),
    title,
    date: dateOnly(article.date),
    category: article.category || "Article",
    description,
    href,
  };
  const announcement: Announcement = {
    id: `ann-article-${article.id}`,
    title,
    description,
    date: notice.date,
    category: article.category || "Article",
    href,
    priority: "normal",
  };
  saveNotice(notice);
  saveAnnouncement(announcement);
  postNotice(notice);
}
