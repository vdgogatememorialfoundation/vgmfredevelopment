"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { activeFestival, festivalPresets, indiaToday } from "@/lib/festival-themes";
import { applySiteTheme } from "@/lib/site-text";
import { useSiteText } from "@/lib/use-site-text";

const PORTALS = ["/admin", "/staff", "/support", "/doctor", "/delivery"];

function subscribeDay(onChange: () => void) {
  const timer = window.setInterval(onChange, 5 * 60 * 1000);
  return () => window.clearInterval(timer);
}

/** Paints published site colours, switching to a scheduled festival theme on its dates. */
export function SiteTheme() {
  const siteText = useSiteText();
  const pathname = usePathname() ?? "/";
  const today = useSyncExternalStore(subscribeDay, () => indiaToday(), () => "");
  const portal = PORTALS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
  const festival = portal ? null : activeFestival(siteText.festivals, today);
  const festivalId = festival?.preset.id ?? "";

  useEffect(() => {
    const preset = festivalPresets.find((item) => item.id === festivalId);
    applySiteTheme(preset ? { ...siteText.theme, ...preset.colors } : siteText.theme);
    const root = document.documentElement;
    if (preset) root.dataset.festival = preset.id;
    else delete root.dataset.festival;
  }, [siteText.theme, festivalId]);

  if (!festival) return null;
  return (
    <div
      className="border-b border-gold/40 bg-gradient-to-r from-saffron/10 via-gold/15 to-saffron/10 text-center text-[13px] font-semibold text-burgundy-dark"
      role="note"
    >
      <p className="container flex items-center justify-center gap-2 py-1">
        <span aria-hidden>{festival.preset.decor}</span>
        <span>{festival.greeting}</span>
        <span aria-hidden>{festival.preset.decor}</span>
      </p>
    </div>
  );
}
