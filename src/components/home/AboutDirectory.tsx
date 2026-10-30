"use client";

import Link from "next/link";
import { useAbout } from "@/lib/about";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function AboutDirectory() {
  const about = useAbout();
  const { t } = useI18n();
  const sections = about.sections.filter((section) => section.href);

  if (!sections.length) return null;

  return (
    <section className="border-t border-border bg-paper py-10 sm:py-12" aria-labelledby="about-directory-heading">
      <div className="container">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-burgundy">{t("about.eyebrow")}</p>
          <h2 id="about-directory-heading" className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {t("home.aboutTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">{t("home.aboutText")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <article
              key={section.id}
              className="flex h-full flex-col rounded-xl border border-border bg-white px-4 py-5 shadow-sm"
            >
              {section.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={section.image} alt="" className="mb-4 aspect-[16/9] w-full rounded-lg object-cover" />
              ) : null}
              <p className="font-serif text-base font-semibold text-ink">{section.title}</p>
              <p className="mt-2 flex-1 text-sm leading-6 text-text-muted">{section.body}</p>
              <Link
                href={section.href!}
                className="mt-4 inline-flex items-center text-sm font-semibold text-burgundy hover:underline"
              >
                {t("about.learnMore")}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
