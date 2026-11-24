"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSiteText } from "@/lib/use-site-text";
import { useI18n } from "@/components/i18n/LanguageProvider";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  showDescription?: boolean;
  breadcrumb?: { name: string; href: string }[];
}

export default function PageHeader({
  eyebrow: baseEyebrow,
  title: baseTitle,
  description: baseDescription,
  showDescription = false,
  breadcrumb,
}: PageHeaderProps) {
  const { t } = useI18n();
  const pathname = usePathname() || "/";
  const pages = useSiteText().pages;
  const copy = pages[pathname.replace(/\/+$/, "") || "/"] ?? {};
  const eyebrow = copy.eyebrow?.trim() || baseEyebrow;
  const title = copy.title?.trim() || baseTitle;
  const description = showDescription ? copy.description?.trim() || baseDescription : "";
  const parts = pathname.split("/").filter(Boolean);
  const crumbs =
    breadcrumb && breadcrumb.length > 0
      ? breadcrumb
      : parts.map((part, index) => ({
          name: index === parts.length - 1 ? title : decodeURIComponent(part).replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
          href: `/${parts.slice(0, index + 1).join("/")}`,
        }));
  return (
    <section className="border-b border-border bg-paper">
      <div className="container py-7 sm:py-8">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <li>
                <Link
                  href="/"
                  className="transition hover:text-burgundy"
                >
                  {t("common.home")}
                </Link>
              </li>
              {crumbs.map((item, index) => (
                <li key={item.href} className="flex items-center gap-2">
                  <span aria-hidden="true">/</span>
                  {index === crumbs.length - 1 ? (
                    <span className="font-medium text-text-primary">
                      {item.name}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="transition hover:text-burgundy"
                    >
                      {item.name}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {eyebrow && (
          <p className="eyebrow">
            {eyebrow}
          </p>
        )}

        <h1 className="heading-1">{title}</h1>

        {description && (
          <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-text-muted sm:text-base">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}