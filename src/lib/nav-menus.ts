import { ABOUT_NAV } from "@/lib/about";
import { navMessageKey, type MessageKey } from "@/lib/i18n/messages";

export type NavLink = { href: string; key: MessageKey };

const MENUS: Record<string, NavLink[]> = {
  "/about": ABOUT_NAV.map((page) => ({ href: page.href, key: page.key as MessageKey })),
  "/events": [
    { href: "/events", key: "nav.events" },
    { href: "/announcements", key: "nav.announcements" },
  ],
  "/gallery": [
    { href: "/gallery", key: "nav.gallery" },
    { href: "/videos", key: "nav.videos" },
  ],
  "/videos": [
    { href: "/videos", key: "nav.videos" },
    { href: "/gallery", key: "nav.gallery" },
  ],
  "/articles": [
    { href: "/articles", key: "nav.articles" },
    { href: "/books", key: "nav.shopBooks" },
  ],
  "/shop": [
    { href: "/shop", key: "nav.shop" },
    { href: "/books", key: "nav.shopBooks" },
  ],
  "/clinics": [{ href: "/clinics", key: "nav.clinics" }],
  "/contact": [
    { href: "/contact", key: "nav.contact" },
    { href: "/support", key: "nav.support" },
  ],
  "/certificate-verification": [{ href: "/certificate-verification", key: "nav.certificates" }],
};

export function navDropdown(href: string): NavLink[] {
  return MENUS[href] ?? [{ href, key: navMessageKey[href] ?? "nav.about" }];
}
