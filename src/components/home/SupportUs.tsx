"use client";

import Link from "next/link";
import { useSiteFlags } from "@/lib/use-cms";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function SupportUs() {
  const flags = useSiteFlags();
  const { t } = useI18n();
  if (!flags.supportUs) return null;

  return (
    <section className="section" aria-labelledby="support-us-heading">
      <div className="container flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{t("support.eyebrow")}</p>
          <h2 id="support-us-heading" className="heading-2 mt-2">
            {flags.supportUsTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">{flags.supportUsText}</p>
        </div>
        <Link href={flags.supportUsHref || "/contact"} className="btn-primary">
          {t("support.cta")}
        </Link>
      </div>
    </section>
  );
}
