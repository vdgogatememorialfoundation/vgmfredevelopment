import type { SiteChrome, SiteChromeLink } from "@/types";

export const HEADER_STYLES = [
  { id: "classic", label: "Classic bar" },
  { id: "rounded", label: "Rounded card" },
  { id: "pill", label: "Round pill" },
  { id: "minimal", label: "Minimal line" },
  { id: "cream", label: "Cream with gold rule" },
] as const;

export const FOOTER_STYLES = [
  { id: "classic", label: "Classic" },
  { id: "rounded", label: "Rounded card" },
  { id: "white", label: "White" },
  { id: "compact", label: "Compact" },
] as const;

export type HeaderStyle = (typeof HEADER_STYLES)[number]["id"];
export type FooterStyle = (typeof FOOTER_STYLES)[number]["id"];

export const headerShell: Record<
  HeaderStyle,
  { outer: string; header: string }
> = {
  classic: {
    outer: "",
    header:
      "border-b border-gold/40 bg-white shadow-[0_8px_24px_rgba(11,31,58,0.06)]",
  },
  rounded: {
    outer: "px-2 pt-2 sm:px-4 sm:pt-3",
    header:
      "rounded-2xl border border-gold/40 bg-white shadow-[0_10px_30px_rgba(11,31,58,0.08)]",
  },
  pill: {
    outer: "px-2 pt-2 sm:px-4 sm:pt-3",
    header:
      "rounded-[2.5rem] border border-gold/40 bg-white shadow-[0_10px_30px_rgba(11,31,58,0.08)]",
  },
  minimal: { outer: "", header: "border-b border-border bg-white" },
  cream: { outer: "", header: "border-b-2 border-gold bg-paper" },
};

export const footerShell: Record<
  FooterStyle,
  { outer: string; footer: string }
> = {
  classic: { outer: "", footer: "border-t border-gold/40 bg-paper" },
  rounded: {
    outer: "px-2 pb-2 sm:px-4 sm:pb-4",
    footer:
      "rounded-3xl border border-gold/40 bg-paper shadow-[0_-6px_24px_rgba(11,31,58,0.05)]",
  },
  white: { outer: "", footer: "border-t border-border bg-white" },
  compact: { outer: "", footer: "border-t border-gold/40 bg-paper text-sm" },
};

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly { id: T }[],
  fallback: T,
): T {
  return allowed.some((row) => row.id === value) ? (value as T) : fallback;
}

export function headerStyleOf(chrome?: SiteChrome): HeaderStyle {
  return pick(chrome?.headerStyle, HEADER_STYLES, "classic");
}

export function footerStyleOf(chrome?: SiteChrome): FooterStyle {
  return pick(chrome?.footerStyle, FOOTER_STYLES, "classic");
}

/** Only site paths, https links, mail and phone links are kept. */
export function cleanChromeLinks(links?: SiteChromeLink[]): SiteChromeLink[] {
  return (links ?? [])
    .map((link) => ({
      label: (link.label ?? "").trim().slice(0, 40),
      href: (link.href ?? "").trim().slice(0, 300),
      newTab: Boolean(link.newTab),
    }))
    .filter(
      (link) =>
        link.label && /^(\/(?!\/)|https:\/\/|mailto:|tel:)/i.test(link.href),
    )
    .slice(0, 12);
}

export function cleanChrome(chrome?: SiteChrome): SiteChrome {
  return {
    headerText: (chrome?.headerText ?? "").trim().slice(0, 200),
    headerTextHref:
      cleanChromeLinks([{ label: "x", href: chrome?.headerTextHref ?? "" }])[0]
        ?.href ?? "",
    headerStyle: headerStyleOf(chrome),
    headerSticky: Boolean(chrome?.headerSticky),
    footerText: (chrome?.footerText ?? "").trim().slice(0, 400),
    footerNote: (chrome?.footerNote ?? "").trim().slice(0, 200),
    footerStyle: footerStyleOf(chrome),
    navLinks: cleanChromeLinks(chrome?.navLinks),
    footerLinks: cleanChromeLinks(chrome?.footerLinks),
  };
}

export function isExternal(href: string) {
  return /^https:\/\//i.test(href);
}
