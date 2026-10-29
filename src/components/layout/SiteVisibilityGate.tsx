"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getCmsPageBySlug } from "@/lib/cms-pages";
import {
  getSiteVisibility,
  isAccountPageEnabled,
  isPublicPageEnabled,
  publicPageIdForPath,
  subscribeSiteVisibility,
} from "@/lib/site-visibility";

function snapshot() {
  return JSON.stringify(getSiteVisibility());
}

export function SiteVisibilityGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useSyncExternalStore(subscribeSiteVisibility, snapshot, () => "ssr");

  if (pathname.startsWith("/p/")) {
    const slug = pathname.slice(3).split("/").filter(Boolean)[0] ?? "";
    const page = getCmsPageBySlug(slug);
    if (!page || !page.enabled) {
      return (
        <Unavailable
          title="This page is not published"
          text="The Foundation has not enabled this page on the main site yet."
        />
      );
    }
    return <>{children}</>;
  }

  const publicId = publicPageIdForPath(pathname);
  if (publicId && !isPublicPageEnabled(publicId)) {
    return (
      <Unavailable
        title="This page is currently off"
        text="An administrator has switched this page off on the public website."
      />
    );
  }

  if (pathname.startsWith("/account/") && !isAccountPageEnabled(pathname)) {
    return (
      <Unavailable
        title="This dashboard page is off"
        text="This section of My Account is switched off. Other account pages still work."
        href="/account"
        label="Back to My Account"
      />
    );
  }

  return <>{children}</>;
}

function Unavailable({
  title,
  text,
  href = "/",
  label = "Back to home",
}: {
  title: string;
  text: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="container py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-white p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">VGMF</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">{text}</p>
        <Link href={href} className="btn-primary mt-6 inline-flex">
          {label}
        </Link>
      </div>
    </div>
  );
}
