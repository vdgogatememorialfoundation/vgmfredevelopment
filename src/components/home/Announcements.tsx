"use client";

import Link from "next/link";
import Badge from "@/components/common/Badge";
import { useLiveAnnouncements } from "@/lib/use-cms";
import { formatDate } from "@/lib/utils";

export default function AnnouncementsSection() {
  const shown = useLiveAnnouncements()
    .filter((announcement) => announcement.priority === "high")
    .slice(0, 3);

  if (shown.length === 0) return null;

  return (
    <section className="border-y border-border bg-white py-6" aria-labelledby="announcements-heading">
      <div className="container">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Announcements</p>
            <h2 id="announcements-heading" className="mt-1 text-base font-semibold text-text-primary">
              Latest updates
            </h2>
          </div>
          <Link href="/announcements" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
            All announcements
          </Link>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {shown.map((announcement) => (
            <li key={announcement.id}>
              <Link href={announcement.href} className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                <Badge tone="burgundy">{announcement.category}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{announcement.title}</span>
                <time className="text-xs text-text-muted" dateTime={announcement.date}>
                  {formatDate(announcement.date)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
