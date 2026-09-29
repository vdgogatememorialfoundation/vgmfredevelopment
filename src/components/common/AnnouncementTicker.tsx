import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getAnnouncements } from "@/lib/server/content";
import { formatDate } from "@/lib/utils";

export default async function AnnouncementTicker() {
  const announcements = await getAnnouncements();
  const row = [...announcements, ...announcements];

  return (
    <div
      aria-label="Scrolling announcements"
      className="relative flex items-center overflow-hidden border-b border-gold/20 bg-gold-light text-text-primary"
    >
      <div className="relative z-10 flex shrink-0 items-center gap-2 bg-gold py-2.5 pl-4 pr-5 text-[11px] font-bold uppercase tracking-[0.16em] text-navy [clip-path:polygon(0_0,100%_0,calc(100%-10px)_100%,0_100%)] sm:pl-6">
        <Megaphone size={14} />
        <span className="hidden sm:inline">Latest</span>
      </div>
      <div className="mask-fade-x min-w-0 flex-1 overflow-hidden">
        <div className="flex w-max items-center gap-10 py-2.5 pl-6 animate-marquee">
          {row.map((announcement, index) => (
            <Link
              key={`${announcement.id}-${index}`}
              href={announcement.href}
              className="group flex shrink-0 items-center gap-2.5 text-xs font-medium text-text-primary/80 transition hover:text-burgundy"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-burgundy animate-pulse-soft" />
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-burgundy ring-1 ring-burgundy/10">
                {announcement.category}
              </span>
              <span className="max-w-80 truncate group-hover:underline">{announcement.title}</span>
              <time className="hidden text-text-muted md:inline">
                {formatDate(announcement.date)}
              </time>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
