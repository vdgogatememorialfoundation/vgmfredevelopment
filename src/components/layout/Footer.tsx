"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import SiteLogo from "@/components/common/SiteLogo";
import SocialLinks from "@/components/layout/SocialLinks";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { navMessageKey, type MessageKey } from "@/lib/i18n/messages";
import { siteConfig } from "@/lib/constants";
import { getLiveCmsPages, subscribeCmsPages } from "@/lib/cms-pages";
import { getSiteVisibility, subscribeSiteVisibility, visiblePublicNav } from "@/lib/site-visibility";

const legalLinks: { key: MessageKey; href: string }[] = [
  { key: "footer.privacy", href: "/privacy" },
  { key: "footer.terms", href: "/terms" },
  { key: "footer.shipping", href: "/shipping-policy" },
  { key: "footer.returns", href: "/return-policy" },
  { key: "footer.refund", href: "/refund-policy" },
  { key: "footer.cancellation", href: "/cancellation-policy" },
];

function cmsSnapshot() {
  return `${window.localStorage.getItem("vgmf_cms_pages") ?? ""}|${window.localStorage.getItem("vgmf_site_visibility") ?? ""}`;
}

export default function Footer() {
  const { t } = useI18n();
  useSyncExternalStore(
    (onChange) => {
      const unsubPages = subscribeCmsPages(onChange);
      const unsubVis = subscribeSiteVisibility(onChange);
      return () => {
        unsubPages();
        unsubVis();
      };
    },
    cmsSnapshot,
    () => ""
  );
  const visibility = getSiteVisibility();
  const explore = visiblePublicNav(visibility);
  const custom = getLiveCmsPages().filter((page) => page.showInFooter);

  return (
    <footer className="relative mt-8 overflow-hidden border-t border-gold/40 bg-paper text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ink via-gold to-burgundy" />
      <div className="container py-14 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-4">
              <SiteLogo size={52} />
              <div>
                <p className="font-serif text-2xl font-medium leading-none tracking-tight text-ink">Vaidya Gogate</p>
                <p className="mt-1 font-serif italic text-sm text-gold">Memorial Foundation</p>
              </div>
            </div>
            <p className="mt-6 max-w-md font-serif text-lg leading-8 text-ink/80">{t("footer.tagline")}</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-text-muted">{siteConfig.address}</p>
            <p className="mt-2 text-sm text-text-muted">{t("footer.hours")}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href={`mailto:${siteConfig.email}`} className="rounded-full border border-gold/50 bg-gold/20 px-4 py-2 text-xs font-semibold tracking-wide text-burgundy transition hover:bg-gold/40">
                {siteConfig.email}
              </a>
              <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} className="rounded-full border border-gold/40 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-burgundy transition hover:border-gold hover:bg-gold/15">
                {siteConfig.phone}
              </a>
            </div>
          </div>

          <nav aria-label="Footer explore">
            <p className="font-serif text-xl text-ink">{t("footer.explore")}</p>
            <ul className="mt-5 space-y-2.5">
              {explore.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-text-muted transition hover:text-burgundy">
                    {t(navMessageKey[link.href] ?? "nav.about")}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="font-serif text-xl text-ink">{t("footer.pages")}</p>
            <ul className="mt-5 space-y-2.5">
              {custom.length === 0 ? (
                <>
                  <li>
                    <Link href="/about" className="text-sm text-text-muted transition hover:text-burgundy">
                      {t("nav.about")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-sm text-text-muted transition hover:text-burgundy">
                      {t("nav.contact")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/certificate-verification" className="text-sm text-text-muted transition hover:text-burgundy">
                      {t("nav.certificates")}
                    </Link>
                  </li>
                </>
              ) : (
                <>
                {custom.map((page) => (
                  <li key={page.id}>
                    <Link href={`/p/${page.slug}`} className="text-sm text-text-muted transition hover:text-burgundy">
                      {page.title}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/certificate-verification" className="text-sm text-text-muted transition hover:text-burgundy">
                    {t("nav.certificates")}
                  </Link>
                </li>
                </>
              )}
            </ul>
            <div className="mt-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">{t("footer.connect")}</p>
              <SocialLinks tone="dark" always />
              <p className="mt-4">
                <Link href="/app" className="text-sm font-semibold text-burgundy transition hover:text-ink">
                  Get the Android app
                </Link>
              </p>
              <div className="mt-4">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-gold/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} {siteConfig.name}. {t("footer.rights")}
          </p>
          <nav aria-label="Footer legal links" className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-text-muted transition hover:text-burgundy">
                {t(link.key)}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-5 inline-flex rounded-full border border-gold/50 bg-gold/25 px-4 py-2 font-serif text-sm tracking-wide text-burgundy shadow-[0_0_0_1px_rgba(196,149,74,0.15)]">
          Developed by <strong className="ml-1 font-bold">Capture Visual Studios</strong>
        </p>
      </div>
    </footer>
  );
}
