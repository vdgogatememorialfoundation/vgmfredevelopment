import Link from "next/link";
import { ArrowRight, Bell, FileText, Megaphone } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import Badge from "@/components/common/Badge";
import Reveal from "@/components/common/Reveal";
import { announcements, notices } from "@/data/content";
import { formatDate } from "@/lib/utils";

export default function AnnouncementsSection() {
  const lead = announcements.find((item) => item.priority === "high") ?? announcements[0];
  const rest = announcements.filter((item) => item.id !== lead?.id);

  return (
    <section className="section bg-white" aria-labelledby="announcements-heading">
      <div className="container">
        <SectionHeading
          id="announcements-heading"
          eyebrow="News & notices"
          title="Latest from the Foundation"
          description="Announcements, deadlines and important updates — all in one place."
        />

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-6">
            {lead && (
              <Reveal variant="left">
                <Link
                  href={lead.href}
                  className="group relative block overflow-hidden rounded-3xl bg-hero p-8 text-white sm:p-10"
                >
                  <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
                  <Megaphone className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 rotate-[-12deg] text-white/5" />
                  <div className="relative flex items-center gap-3">
                    <Badge tone="gold">{lead.category}</Badge>
                    <time className="text-sm text-white/60" dateTime={lead.date}>
                      {formatDate(lead.date)}
                    </time>
                  </div>
                  <h3 className="relative mt-5 font-display text-2xl font-semibold leading-tight sm:text-3xl">
                    {lead.title}
                  </h3>
                  <p className="relative mt-3 max-w-lg text-sm leading-7 text-white/70">
                    {lead.description}
                  </p>
                  <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold transition group-hover:gap-3">
                    Read announcement <ArrowRight size={16} />
                  </span>
                </Link>
              </Reveal>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              {rest.slice(0, 2).map((item, index) => (
                <Reveal key={item.id} delay={index * 100}>
                  <Link href={item.href} className="card group flex h-full flex-col p-6">
                    <div className="flex items-center gap-3">
                      <Badge tone="burgundy">{item.category}</Badge>
                      <time className="text-xs text-text-muted" dateTime={item.date}>
                        {formatDate(item.date)}
                      </time>
                    </div>
                    <h3 className="mt-4 font-semibold leading-snug text-text-primary group-hover:text-burgundy">
                      {item.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-text-muted">{item.description}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-burgundy">
                      Read more <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal variant="right" className="h-full">
            <div className="flex h-full flex-col rounded-3xl border border-border bg-warm-cream p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="icon-tile h-11 w-11">
                    <Bell size={20} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-text-primary">Notice board</h3>
                    <p className="text-xs text-text-muted">Deadlines & official circulars</p>
                  </div>
                </div>
                <Link href="/notices" className="text-sm font-semibold text-burgundy hover:underline">
                  View all
                </Link>
              </div>

              <ol className="relative mt-6 flex-1 space-y-1 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-border">
                {notices.slice(0, 5).map((notice) => (
                  <li key={notice.id}>
                    <Link
                      href={notice.href}
                      className="group relative flex gap-4 rounded-2xl p-2 transition hover:bg-white"
                    >
                      <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-burgundy transition group-hover:border-burgundy group-hover:bg-burgundy group-hover:text-white">
                        <FileText size={16} />
                      </span>
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                          {notice.category}
                          <span aria-hidden="true">·</span>
                          <time dateTime={notice.date}>{formatDate(notice.date)}</time>
                        </span>
                        <span className="mt-1 block text-sm font-medium leading-snug text-text-primary group-hover:text-burgundy">
                          {notice.title}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>

              <Link href="/announcements" className="btn-outline mt-6 w-full">
                All announcements
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
