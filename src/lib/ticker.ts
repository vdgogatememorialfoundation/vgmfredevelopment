import { getLiveAnnouncements, getLiveEvents, getLiveNotices, getPublishedArticles } from "@/lib/cms";
import { isArticlePublished } from "@/lib/article-display";
import { formatCountdown, isPublishedNow } from "@/lib/schedule";
import type { Announcement, Article, Event, Notice } from "@/types";

export type TickerItem = {
  id: string;
  title: string;
  category: string;
  href: string;
  date: string;
};

function parseStamp(value?: string) {
  if (!value) return NaN;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return Date.parse(`${trimmed}T00:00:00`);
  return Date.parse(trimmed);
}

function noticeItems(notices: Notice[]): TickerItem[] {
  return notices.filter((notice) => isPublishedNow(notice)).map((notice) => ({
    id: `notice-${notice.id}`,
    title: notice.title,
    category: notice.category || "Notice",
    href: notice.href || `/#notices`,
    date: notice.date,
  }));
}

function articleItems(articles: Article[]): TickerItem[] {
  return articles
    .filter((article) => isArticlePublished(article))
    .map((article) => ({
      id: `article-${article.id}`,
      title: article.title,
      category: article.category || "Article",
      href: `/articles/${article.slug}`,
      date: article.date,
    }));
}

function eventItems(events: Event[], now = Date.now()): TickerItem[] {
  const live = events.filter((event) => isPublishedNow(event) && event.registrationStatus !== "Closed");
  const rows: TickerItem[] = live.map((event) => ({
    id: `event-${event.id}`,
    title: event.name,
    category: event.eventType || "Event",
    href: `/events/${event.slug}`,
    date: event.startDate,
  }));

  for (const event of live) {
    if (!event.tbd?.dates) {
      const starts = parseStamp(event.startDate);
      if (Number.isFinite(starts) && starts > now) {
        rows.push({
          id: `evtstart-${event.id}`,
          title: `“${event.name}” starts in ${formatCountdown(starts - now).label}`,
          category: "Countdown",
          href: `/events/${event.slug}`,
          date: event.startDate,
        });
      }
    }
    if (event.tbd?.registration) continue;
    const opens = parseStamp(event.registrationStart);
    const closes = parseStamp(event.registrationEnd);
    if (Number.isFinite(opens) && opens > now) {
      rows.push({
        id: `regopen-${event.id}`,
        title: `Registration for “${event.name}” opens in ${formatCountdown(opens - now).label}`,
        category: "Countdown",
        href: `/events/${event.slug}`,
        date: event.registrationStart,
      });
    }
    if (Number.isFinite(closes) && closes > now) {
      rows.push({
        id: `regclose-${event.id}`,
        title: `Registration for “${event.name}” closes in ${formatCountdown(closes - now).label}`,
        category: "Countdown",
        href: `/events/${event.slug}`,
        date: event.registrationEnd,
      });
    }
  }
  return rows;
}

export function buildTickerItems(now = Date.now()): TickerItem[] {
  const announcements = getLiveAnnouncements()
    .filter((item: Announcement) => isPublishedNow(item))
    .map((item) => ({
      id: `ann-${item.id}`,
      title: item.title,
      category: item.category || "Update",
      href: item.href || "/announcements",
      date: item.date,
    }));
  const notices = noticeItems(getLiveNotices());
  const events = eventItems(getLiveEvents(), now);
  const articles = articleItems(getPublishedArticles());
  const seen = new Set<string>();
  const merged: TickerItem[] = [];
  for (const item of [...announcements, ...notices, ...events, ...articles]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
