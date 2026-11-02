"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function LegacySection() {
  const { t } = useI18n();

  return (
    <section className="section" aria-labelledby="legacy-heading">
      <div className="container">
        <div className="grid items-center gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12">
          <div className="mx-auto h-40 w-40 overflow-hidden rounded-xl border border-border bg-white shadow-sm sm:h-44 sm:w-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/about/rb-square.jpg"
              alt="Vaidya R. B. Gogate"
              width={176}
              height={176}
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <p className="eyebrow">{t("legacy.eyebrow")}</p>
            <h2 id="legacy-heading" className="heading-2 mt-1">
              {t("legacy.title")}
            </h2>
            <p className="mt-2 text-sm font-semibold text-burgundy">{t("legacy.portraitRole")}</p>
            <Link href="/about/legacy-of-vaidya-rb-gogate" className="btn-primary mt-6">
              {t("legacy.readMore")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
