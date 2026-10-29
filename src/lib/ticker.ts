import { getLiveAnnouncements, getLiveEvents, getLiveNotices } from "@/lib/cms";
import { formatCountdown, isPublishedNow } from "@/lib/schedule";
import type { Announcement, Event, Notice } from "@/types";

export type TickerItem = {
  id: string;
  title: string;
  category: string;
  href: string;
  date: string;
};

function noticeItems(notices: Notice[]): TickerItem[] {
  return notices.filter((notice) => isPublishedNow(notice)).map((notice) => ({
    id: `notice-${notice.id}`,
    title: notice.title,
    category: notice.category || "Notice",
    href: notice.href || `/notices#${notice.id}`,
    date: notice.date,
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
    if (event.tbd?.registration) continue;
    const opens = event.registrationStart ? Date.parse(event.registrationStart) : NaN;
    const closes = event.registrationEnd ? Date.parse(event.registrationEnd) : NaN;
    if (Number.isFinite(opens) && opens > now) {
      rows.push({
        id: `regopen-${event.id}`,
        title: `Registration for “${event.name}” opens in ${formatCountdown(opens - now).label}`,
        category: "Countdown",
        href: `/events/${event.slug}`,
        date: event.registrationStart,
      });
    } else if (Number.isFinite(closes) && closes > now) {
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
  const seen = new Set<string>();
  const merged: TickerItem[] = [];
  for (const item of [...announcements, ...notices, ...events]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
