"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const COOKIE_CONSENT_KEY = "vgmf_cookie_consent";
export const OPEN_COOKIE_SETTINGS = "vgmf:cookie-settings";

export type CookieChoice = "all" | "essential";

export function cookieChoice(): CookieChoice | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  return value === "all" || value === "essential" ? value : null;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(!cookieChoice()), 600);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen);
    };
  }, []);

  const choose = (choice: CookieChoice) => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    document.cookie = `${COOKIE_CONSENT_KEY}=${choice}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setOpen(false);
    window.dispatchEvent(new Event("vgmf:cookie-consent"));
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-label="Cookie notice" className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-2xl border border-border bg-white p-4 shadow-xl sm:p-5">
      <p className="font-semibold text-text-primary">We use cookies</p>
      <p className="mt-1 text-sm leading-6 text-text-muted">
        Essential cookies keep you signed in, hold your cart and keep the site secure. With your consent we also use analytics
        (Google Analytics) and advertising (Google AdSense on articles) cookies. Read our{" "}
        <Link href="/privacy" className="font-medium text-burgundy underline">Privacy Policy</Link>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose("all")} className="btn-primary px-4 py-2 text-sm">Accept all</button>
        <button type="button" onClick={() => choose("essential")} className="btn-outline px-4 py-2 text-sm">Essential only</button>
      </div>
    </div>
  );
}
