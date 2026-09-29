import Link from "next/link";
import { announcements } from "@/data/content";
import { formatDate } from "@/lib/utils";

export default function AnnouncementTicker() {
  const row = [...announcements, ...announcements];

  return (
    <div
      aria-label="Scrolling announcements"
      className="overflow-hidden border-b border-border bg-burgundy-dark text-white"
    >
      <div className="flex w-max items-center gap-10 py-2.5 pl-10 animate-marquee">
        {row.map((announcement, index) => (
          <Link
            key={`${announcement.id}-${index}`}
            href={announcement.href}
            className="flex shrink-0 items-center gap-2.5 text-xs font-medium text-white/90 transition hover:text-white"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              {announcement.category}
            </span>
            <span className="max-w-72 truncate">{announcement.title}</span>
            <time className="hidden text-white/40 md:inline">
              {formatDate(announcement.date)}
            </time>
          </Link>
        ))}
      </div>
    </div>
  );
}