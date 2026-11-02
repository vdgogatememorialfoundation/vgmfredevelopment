"use client";

import { useEffect, useState, type ReactNode } from "react";
import { emptyFeedFallback } from "@/lib/mobile-publish";
import type { MobileFeed } from "@/lib/mobile-types";
import { setMailReady } from "@/lib/auth-access";
import { syncCommerce } from "@/lib/commerce-sync";
import { hydratePublishedSite, setPublishedFeed } from "@/lib/hydrate-public";
import { hydratePartnerFeed } from "@/lib/partner-hydrate";

export type PublishedBrand = Pick<MobileFeed, "site" | "flyers" | "publishedAt" | "siteText"> &
  Partial<Pick<MobileFeed, "banners" | "awards" | "thanks">> &
  Partial<Pick<MobileFeed, "books" | "events" | "articles" | "clinics" | "videos" | "notices" | "announcements" | "gallery">>;

export function HydratePublishedSite({
  initial,
  children,
}: {
  initial?: PublishedBrand | null;
  children?: ReactNode;
}) {
  useState(() => {
    if (!initial?.site) return false;
    setPublishedFeed({
      ...emptyFeedFallback(),
      ...(initial as MobileFeed),
      site: initial.site,
      flyers: initial.flyers ?? [],
      banners: initial.banners ?? [],
      awards: initial.awards ?? [],
      thanks: initial.thanks ?? [],
      publishedAt: initial.publishedAt,
      siteText: initial.siteText,
    });
    return true;
  });

  useEffect(() => {
    void hydratePublishedSite();
    void hydratePartnerFeed();
    void syncCommerce();
    void fetch("/api/auth/mail-status", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json() as Promise<{ emailOtp?: boolean }>)
      .then((data) => setMailReady(Boolean(data.emailOtp)))
      .catch(() => undefined);
  }, []);

  return <>{children}</>;
}
