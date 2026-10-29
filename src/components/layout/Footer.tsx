"use client";

import Link from "next/link";
import SiteLogo from "@/components/common/SiteLogo";
import SocialLinks from "@/components/layout/SocialLinks";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { navMessageKey, type MessageKey } from "@/lib/i18n/messages";
import { siteConfig } from "@/lib/constants";

const quickLinks = [
  { key: "nav.about" as MessageKey, href: "/about" },
  { key: "nav.events" as MessageKey, href: "/events" },
  { key: "nav.gallery" as MessageKey, href: "/gallery" },
  { key: "nav.articles" as MessageKey, href: "/articles" },
  { key: "nav.shop" as MessageKey, href: "/shop" },
  { key: "nav.clinics" as MessageKey, href: "/clinics" },
  { key: "nav.contact" as MessageKey, href: "/contact" },
];

const programmeLinks = [
  { key: "nav.events" as MessageKey, href: "/events" },
  { key: "nav.articles" as MessageKey, href: "/articles" },
  { key: "nav.videos" as MessageKey, href: "/videos" },
  { key: "nav.gallery" as MessageKey, href: "/gallery" },
];

const legalLinks: { key: MessageKey; href: string }[] = [
  { key: "footer.privacy", href: "/privacy" },
  { key: "footer.terms", href: "/terms" },
  { key: "footer.shipping", href: "/shipping-policy" },
  { key: "footer.returns", href: "/return-policy" },
  { key: "footer.refund", href: "/refund-policy" },
  { key: "footer.cancellation", href: "/cancellation-policy" },
];

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t-2 border-gold bg-ink text-stone-200">
      <div className="container py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <SiteLogo size={44} />
              <div>
                <p className="font-serif text-base font-semibold leading-tight text-white">Vaidya Gogate</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Memorial Foundation</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-stone-400">{t("footer.tagline")}</p>
            <p className="mt-4 text-sm leading-6 text-stone-400">{siteConfig.address}</p>
            <div className="mt-5">
              <LanguageSwitcher tone="dark" />
            </div>
          </div>

          <nav aria-label="Footer quick links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{t("footer.explore")}</p>
            <ul className="mt-4 grid gap-2.5 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-stone-200 transition hover:text-gold">
                    {t(navMessageKey[link.href] ?? link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Footer programmes">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{t("footer.programmes")}</p>
            <ul className="mt-4 grid gap-2.5 text-sm">
              {programmeLinks.map((link) => (
                <li key={`p-${link.href}`}>
                  <Link href={link.href} className="text-stone-200 transition hover:text-gold">
                    {t(navMessageKey[link.href] ?? link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{t("footer.office")}</p>
            <div className="mt-4 grid gap-2 text-sm text-stone-200">
              <a href={`mailto:${siteConfig.email}`} className="transition hover:text-gold">
                {siteConfig.email}
              </a>
              <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} className="transition hover:text-gold">
                {siteConfig.phone}
              </a>
            </div>
            <SocialLinks className="mt-5" />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs text-stone-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {siteConfig.name}. {t("footer.rights")}</p>
          <nav aria-label="Footer legal links" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-gold">
                {t(link.key)}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-4 text-xs tracking-wide text-stone-500">{t("footer.developed")}</p>
      </div>
    </footer>
  );
}
