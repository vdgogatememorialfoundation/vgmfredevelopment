"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function LegacySection() {
  const { t } = useI18n();
  const pillars = [
    { title: t("legacy.ayurveda"), description: t("legacy.ayurvedaText") },
    { title: t("legacy.education"), description: t("legacy.educationText") },
    { title: t("legacy.service"), description: t("legacy.serviceText") },
  ];

  return (
    <section className="section" aria-labelledby="legacy-heading">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow={t("legacy.eyebrow")}
              title={t("legacy.title")}
              description={t("legacy.desc")}
            />

            <ul className="grid gap-4 sm:grid-cols-3" role="list">
              {pillars.map((pillar) => (
                <li key={pillar.title} className="rounded-2xl border border-border bg-white p-5">
                  <p className="font-semibold text-burgundy">{pillar.title}</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{pillar.description}</p>
                </li>
              ))}
            </ul>

            <Link href="/about/legacy-of-vaidya-rb-gogate" className="btn-primary mt-8">
              {t("legacy.readMore")}
            </Link>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="flex h-full items-center justify-center bg-paper p-8 text-center">
                <div>
                  <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-gold">
                    <span className="font-serif font-bold text-ink">VGMF</span>
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">Vaidya R. B. Gogate</h2>
                  <p className="mt-2 text-sm text-text-muted">{t("legacy.portraitRole")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
