"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/LanguageProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const items: { href: string; eyebrow: MessageKey; title: MessageKey; text: MessageKey }[] = [
  {
    href: "/notices",
    eyebrow: "home.dirOffice",
    title: "home.dirNotices",
    text: "home.dirNoticesText",
  },
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
  return (
    <section className="border-t border-border bg-white py-8" aria-label="Foundation services">
      <div className="container grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
