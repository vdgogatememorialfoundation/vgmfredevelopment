"use client";

import { useEffect } from "react";
import { applySiteTheme } from "@/lib/site-text";
import { useSiteText } from "@/lib/use-site-text";

/** Paints published site and tracking colours onto the document. */
export function SiteTheme() {
  const theme = useSiteText().theme;
  useEffect(() => {
    applySiteTheme(theme);
  }, [theme]);
  return null;
}
