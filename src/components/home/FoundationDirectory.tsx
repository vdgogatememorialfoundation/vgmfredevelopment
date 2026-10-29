"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/LanguageProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useMergedNotices } from "@/lib/use-notices";
import { formatDate } from "@/lib/utils";

const items: { href: string; eyebrow: MessageKey; title: MessageKey; text: MessageKey }[] = [
  {
    href: "/events",
    eyebrow: "home.dirProgrammes",
    title: "home.dirEvents",
    text: "home.dirEventsText",
  },
  {
    href: "/articles",
    eyebrow: "home.dirJournal",
    title: "home.dirArticles",
    text: "home.dirArticlesText",
  },
  {
    href: "/clinics",
    eyebrow: "home.dirCare",
    title: "home.dirClinics",
    text: "home.dirClinicsText",
  },
];

export default function FoundationDirectory() {
  const { t } = useI18n();
  const { notices: all } = useMergedNotices();
  const notices = (all.filter((notice) => notice.pinned).length ? all.filter((notice) => notice.pinned) : all).slice(0, 3);

  return (
    <section className="border-t border-border bg-white py-8" aria-label="Foundation services">
      <div className="container grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-paper px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-burgundy">{t("home.noticeEyebrow")}</p>
              <p className="mt-1 font-serif text-base font-semibold text-ink">{t("home.noticeBoard")}</p>
            </div>
            <Link href="/notices" className="text-xs font-semibold text-burgundy">
              {t("home.allNotices")}
            </Link>
          </div>
          {notices.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">{t("home.noticeEmpty")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notices.map((notice) => (
                <li key={notice.id} className="border-t border-border/70 pt-2 first:border-t-0 first:pt-0">
                  <p className="line-clamp-2 text-sm font-medium text-ink">{notice.title}</p>
                  <time className="text-[11px] text-text-muted" dateTime={notice.date}>
                    {formatDate(notice.date)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-border bg-paper px-4 py-4 transition hover:border-burgundy"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-burgundy">{t(item.eyebrow)}</p>
            <p className="mt-1 font-serif text-base font-semibold text-ink">{t(item.title)}</p>
            <p className="mt-1 text-sm leading-6 text-text-muted">{t(item.text)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
