"use client";

import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import { siteConfig } from "@/lib/constants";
import ContactForm from "@/components/store/ContactForm";
import SocialLinks from "@/components/layout/SocialLinks";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function ContactPage() {
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("contact.eyebrow")} title={t("contact.title")} description={t("contact.desc")} />
      <section className="section bg-background">
        <div className="container grid gap-10 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">{t("contact.address")}</h2>
              <p className="mt-3 text-sm leading-6 text-text-primary">{siteConfig.address}</p>
            </div>
            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">{t("contact.email")}</h2>
              <a href={`mailto:${siteConfig.email}`} className="mt-3 inline-block text-sm font-medium text-burgundy hover:underline">
                {siteConfig.email}
              </a>
            </div>
            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">{t("contact.phone")}</h2>
              <a href={`tel:${siteConfig.phone}`} className="mt-3 inline-block text-sm font-medium text-burgundy hover:underline">
                {siteConfig.phone}
              </a>
            </div>
            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">{t("contact.shop")}</h2>
              <Link href="/shop" className="mt-3 inline-block text-sm font-medium text-burgundy hover:underline">
                {t("contact.browse")}
              </Link>
            </div>
            <SocialLinks className="card p-6 sm:col-span-2" tone="dark" title={t("common.followUs")} />
          </div>
          <ContactForm />
        </div>
      </section>
    </main>
  );
}
