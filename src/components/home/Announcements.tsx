import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import Badge from "@/components/common/Badge";
import { announcements } from "@/data/content";
import { formatDate } from "@/lib/utils";

export default function AnnouncementsSection() {
  const shown = announcements.filter(
    (announcement) => announcement.priority === "high"
  );

  return (
    <section
      className="section bg-background"
      aria-labelledby="announcements-heading"
    >
      <div className="container">
        <SectionHeading
          eyebrow="Announcements"
          title="Latest Updates"
          description="Stay informed with the latest news and announcements from the Foundation."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((announcement) => (
            <article
              key={announcement.id}
              className="card flex flex-col p-6"
            >
              <div className="flex items-center gap-3">
                <Badge tone="burgundy">{announcement.category}</Badge>
                <time
                  className="text-sm text-text-muted"
                  dateTime={announcement.date}
                >
                  {formatDate(announcement.date)}
                </time>
              </div>

              <h3 className="mt-4 text-lg font-semibold leading-snug text-text-primary">
                {announcement.title}
              </h3>

              <p className="mt-2 text-sm text-text-muted line-clamp-3">
                {announcement.description}
              </p>

              <Link
                href={announcement.href}
                className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-burgundy transition hover:text-burgundy-dark"
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

        <div className="mt-10 text-center">
          <Link href="/announcements" className="btn-outline">
            View All Announcements
          </Link>
        </div>
      </div>
    </section>
  );
}