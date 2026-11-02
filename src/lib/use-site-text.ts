"use client";

import { useSyncExternalStore } from "react";
import { getPublishedSiteText, getSiteText, subscribeSiteText, type SiteText } from "@/lib/site-text";

let serverRaw = "";
let serverValue: SiteText | null = null;

function serverSnapshot() {
  const value = getPublishedSiteText();
  const raw = JSON.stringify(value);
  if (raw !== serverRaw || !serverValue) {
    serverRaw = raw;
    serverValue = value;
  }
  return serverValue;
}

export function useSiteText(): SiteText {
  return useSyncExternalStore(subscribeSiteText, getSiteText, serverSnapshot);
}
