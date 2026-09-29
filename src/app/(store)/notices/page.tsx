import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import Badge from "@/components/common/Badge";
import { getNotices } from "@/lib/server/content";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Notice Board",
  description:
    "Official notices, deadlines, results and updates from the Vaidya Gogate Memorial Foundation.",
};

export default async function NoticesPage() {
  const notices = await getNotices();
  const sorted = [...notices].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main>
      <PageHeader
        eyebrow="Notice Board"
        title="All Notices"
        description="Official notices, deadlines and important updates from the Foundation."
      />

      <section className="section bg-background">
        <div className="container max-w-4xl space-y-4">
          {sorted.map((notice) => (
            <article key={notice.id} className="card p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="burgundy">{notice.category}</Badge>
                <time className="text-sm text-text-muted" dateTime={notice.date}>
                  {formatDate(notice.date)}
                </time>
              </div>

              <h2 className="mt-3 text-xl font-semibold text-text-primary">
                {notice.title}
              </h2>

              <p className="mt-2 text-text-muted">{notice.description}</p>

              {notice.attachment && (
                <p className="mt-4 flex items-center gap-2 text-sm text-text-muted">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {notice.attachment}
                </p>
              )}

              <Link
                href={notice.href}
                className="btn-outline mt-5 px-5 py-2.5 text-sm"
              >
                Read More
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}