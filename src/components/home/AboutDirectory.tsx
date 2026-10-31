"use client";

import Link from "next/link";
import { NaturalImage } from "@/components/common/NaturalImage";
import { rbPortrait, useAbout } from "@/lib/about";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function AboutDirectory() {
  const about = useAbout();
  const { t } = useI18n();
  const portrait = rbPortrait(about);
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
        {portrait ? (
          <div className="mb-10 grid items-start gap-4" style={{ gridTemplateColumns: "96px minmax(0, 1fr)" }}>
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm" style={{ width: 96, height: 96 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portrait} alt="Vaidya R. B. Gogate" width={96} height={96} style={{ width: 96, height: 96, objectFit: "cover", objectPosition: "top" }} />
            </div>
            <div className="min-w-0">
              <p className="font-serif text-xl font-semibold text-ink">{about.legacy.title}</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-muted">
                {about.legacy.biography.split(/\n\s*\n/)[0]}
              </p>
              <Link href="/about/legacy-of-vaidya-rb-gogate" className="mt-4 inline-flex text-sm font-semibold text-burgundy hover:underline">
                {t("about.learnMore")}
              </Link>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <article
              key={section.id}
              className="flex h-full flex-col rounded-xl border border-border bg-white px-4 py-5 shadow-sm"
            >
              {section.image ? (
                <NaturalImage src={section.image} alt="" fit="card" className="mb-4 rounded-lg" />
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
