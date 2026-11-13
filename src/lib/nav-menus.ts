import { ABOUT_NAV } from "@/lib/about";
import type { MessageKey } from "@/lib/i18n/messages";

export type NavLink = { href: string; key: MessageKey };

/** Child pages only — never repeat the parent or a sibling top-level item. */
const MENUS: Record<string, NavLink[]> = {
  "/events": [
    { href: "/schedules", key: "nav.schedules" },
    { href: "/speakers", key: "nav.speakers" },
  ],
  "/about": ABOUT_NAV.filter((page) => page.href !== "/about").map((page) => ({
    href: page.href,
    key: page.key as MessageKey,
  })),
  "/legal": [
    { href: "/privacy", key: "footer.privacy" },
    { href: "/terms", key: "footer.terms" },
    { href: "/shipping-policy", key: "footer.shipping" },
    { href: "/return-policy", key: "footer.returns" },
    { href: "/refund-policy", key: "footer.refund" },
    { href: "/cancellation-policy", key: "footer.cancellation" },
    { href: "/faq", key: "footer.faq" },
  ],
};

export function navDropdown(href: string): NavLink[] {
  return (MENUS[href] ?? []).filter((page) => page.href !== href);
}

export function navHasMenu(href: string) {
  return navDropdown(href).length > 0;
}
