"use client";

import Link from "next/link";
import { useLiveAnnouncements } from "@/lib/use-cms";
import { formatDate } from "@/lib/utils";

export default function AnnouncementTicker() {
  const announcements = useLiveAnnouncements();
  const row = [...announcements, ...announcements];

  return (
    <div
      aria-label="Scrolling announcements"
      className="overflow-hidden border-b border-border bg-white text-text-primary"
    >
      <div className="flex w-max items-center gap-10 py-2.5 pl-10 animate-marquee">
        {row.map((announcement, index) => (
          <Link
            key={`${announcement.id}-${index}`}
            href={announcement.href}
            className="flex shrink-0 items-center gap-2.5 text-xs font-medium text-text-primary transition hover:text-burgundy"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-burgundy/10 text-[10px] text-burgundy">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </span>
            <span className="rounded bg-warm-cream px-1.5 text-burgundy py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              {announcement.category}
            </span>
            <span className="max-w-72 truncate">{announcement.title}</span>
            <time className="hidden text-text-muted md:inline">
              {formatDate(announcement.date)}
            </time>
          </Link>
        ))}
      </div>
    </div>
  );
}