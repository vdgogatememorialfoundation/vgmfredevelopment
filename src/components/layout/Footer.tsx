"use client";

import Link from "next/link";
import SiteLogo from "@/components/common/SiteLogo";
import SocialLinks from "@/components/layout/SocialLinks";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { navMessageKey, type MessageKey } from "@/lib/i18n/messages";

const quickLinks = [
  { key: "nav.about" as MessageKey, href: "/about" },
  { key: "nav.notices" as MessageKey, href: "/notices" },
  { key: "nav.events" as MessageKey, href: "/events" },
  { key: "nav.articles" as MessageKey, href: "/articles" },
  { key: "nav.shop" as MessageKey, href: "/shop" },
  { key: "nav.clinics" as MessageKey, href: "/clinics" },
  { key: "nav.contact" as MessageKey, href: "/contact" },
];

const legalLinks: { key: MessageKey; href: string }[] = [
  { key: "footer.privacy", href: "/privacy" },
  { key: "footer.terms", href: "/terms" },
  { key: "footer.shipping", href: "/shipping-policy" },
  { key: "footer.returns", href: "/return-policy" },
  { key: "footer.refund", href: "/refund-policy" },
];

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-ink text-stone-200">
      <div className="container py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-3">
              <SiteLogo size={40} />
              <div>
                <p className="font-semibold leading-tight">Vaidya Gogate</p>
                <p className="text-[11px] uppercase tracking-[0.12em] text-stone-400">
                  Memorial Foundation
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-stone-400">
              Ayurveda education, publications and clinical care.
            </p>
            <div className="mt-4">
              <LanguageSwitcher tone="dark" />
            </div>
          </div>

          <nav aria-label="Footer quick links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">{t("footer.explore")}</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-stone-200 transition hover:text-white">
                    {t(navMessageKey[link.href] ?? link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">{t("footer.contact")}</p>
            <div className="mt-3 grid gap-2 text-sm text-stone-200">
              <a href="mailto:info@vaidyagogate.org" className="transition hover:text-white">
                info@vaidyagogate.org
              </a>
              <span>+91 20 1234 5678</span>
            </div>
            <SocialLinks className="mt-4" />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-ink-soft pt-6 text-xs text-stone-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Vaidya Gogate Memorial Foundation. {t("footer.rights")}</p>
          <nav aria-label="Footer legal links" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {t(link.key)}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-4 text-xs text-stone-500">
          {t("footer.developed")}
        </p>
      </div>
    </footer>
  );
}
