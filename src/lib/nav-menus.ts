import { ABOUT_NAV } from "@/lib/about";
import type { MessageKey } from "@/lib/i18n/messages";

export type NavLink = { href: string; key: MessageKey };

/** Child pages only — never repeat the parent or a sibling top-level item. */
const MENUS: Record<string, NavLink[]> = {
  "/about": ABOUT_NAV.filter((page) => page.href !== "/about").map((page) => ({
    href: page.href,
    key: page.key as MessageKey,
  })),
};

export function navDropdown(href: string): NavLink[] {
  return (MENUS[href] ?? []).filter((page) => page.href !== href);
}

export function navHasMenu(href: string) {
  return navDropdown(href).length > 0;
}
