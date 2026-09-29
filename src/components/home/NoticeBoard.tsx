import Link from "next/link";
import Badge from "@/components/common/Badge";
import { notices } from "@/data/content";
import { formatDate } from "@/lib/utils";

export default function NoticeBoard() {
  return (
    <section className="section bg-background py-10" aria-labelledby="notices-heading">
      <div className="container">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-burgundy/5 text-burgundy">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              </span>
              <div>
                <h2
                  id="notices-heading"
                  className="text-lg font-bold text-text-primary"
                >
                  Important Notices
                </h2>
                <p className="text-sm text-text-muted">
                  Announcements, deadlines and updates from the Foundation.
                </p>
              </div>
            </div>

            <Link
              href="/notices"
              className="flex items-center gap-1.5 text-sm font-semibold text-burgundy transition hover:text-burgundy-dark"
            >
              View All Notices
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-warm-cream">
            {notices.slice(0, 4).map((notice) => (
              <Link
                key={notice.id}
                href={notice.href}
                aria-label={`${notice.title} (${formatDate(notice.date)})`}
                className="flex flex-col gap-2 px-5 py-4 transition hover:bg-white sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="flex w-fit shrink-0 items-center gap-2 text-xs font-medium text-text-muted sm:w-32">
                  <Badge tone="burgundy">{notice.category}</Badge>
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-text-primary line-clamp-1">
                  {notice.title}
                </span>
                <time
                  className="shrink-0 text-xs text-text-muted"
                  dateTime={notice.date}
                >
                  {formatDate(notice.date)}
                </time>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}