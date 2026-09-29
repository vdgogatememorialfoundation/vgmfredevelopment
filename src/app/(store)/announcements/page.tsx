import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import Badge from "@/components/common/Badge";
import { announcements } from "@/data/content";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Announcements",
  description:
    "All announcements from the Vaidya Gogate Memorial Foundation.",
};

export default function AnnouncementsPage() {
  const sorted = [...announcements].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return (
    <main>
      <PageHeader
        eyebrow="Announcements"
        title="All Announcements"
        description="News and updates from the Vaidya Gogate Memorial Foundation."
      />

      <section className="section bg-background">
        <div className="container max-w-4xl space-y-4">
          {sorted.map((announcement) => (
            <article key={announcement.id} className="card p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="burgundy">{announcement.category}</Badge>
                <time className="text-sm text-text-muted" dateTime={announcement.date}>
                  {formatDate(announcement.date)}
                </time>
              </div>

              <h2 className="mt-3 text-xl font-semibold text-text-primary">
                {announcement.title}
              </h2>

              <p className="mt-2 text-text-muted">{announcement.description}</p>

              <Link
                href={announcement.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-burgundy transition hover:text-burgundy-dark"
              >
                Read More
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}