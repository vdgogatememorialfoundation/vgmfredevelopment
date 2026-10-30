"use client";

import { useEffect, useState, type ReactNode } from "react";
import { emptyFeedFallback } from "@/lib/mobile-publish";
import type { MobileFeed } from "@/lib/mobile-types";
import { hydratePublishedSite, setPublishedFeed } from "@/lib/hydrate-public";
import { hydratePartnerFeed } from "@/lib/partner-hydrate";

export type PublishedBrand = Pick<MobileFeed, "site" | "flyers" | "publishedAt">;

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
      publishedAt: initial.publishedAt,
    });
    return true;
  });

  useEffect(() => {
    void hydratePublishedSite();
    void hydratePartnerFeed();
  }, []);

  return <>{children}</>;
}
