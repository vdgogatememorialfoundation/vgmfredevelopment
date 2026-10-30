import { accountNavigation, navigation } from "@/lib/constants";
import { allStaffModules } from "@/lib/roles";
import { subscribeCms } from "@/lib/cms";

const KEY = "vgmf_site_visibility";

export type VisibilitySurface = "public" | "staff" | "account";

export type SiteVisibility = {
  public: Record<string, boolean>;
  staff: Record<string, boolean>;
  account: Record<string, boolean>;
};

export const publicSitePages = [
  { id: "about", label: "About Us", href: "/about" },
  { id: "events", label: "Events", href: "/events" },
  { id: "gallery", label: "Gallery", href: "/gallery" },
  { id: "videos", label: "Videos", href: "/videos" },
  { id: "articles", label: "Articles", href: "/articles" },
  { id: "shop", label: "Shop", href: "/shop" },
  { id: "clinics", label: "Clinics", href: "/clinics" },
  { id: "contact", label: "Contact", href: "/contact" },
  { id: "support", label: "Support", href: "/support" },
  { id: "announcements", label: "Announcements", href: "/announcements" },
  { id: "certificates", label: "Certificate verification", href: "/certificate-verification" },
] as const;

export type PublicPageId = (typeof publicSitePages)[number]["id"];

function defaults(): SiteVisibility {
  return {
    public: Object.fromEntries(publicSitePages.map((page) => [page.id, true])),
    staff: Object.fromEntries(allStaffModules().map((moduleItem) => [moduleItem.id, true])),
    account: Object.fromEntries(accountNavigation.map((item) => [item.href, true])),
  };
}

function read(): SiteVisibility {
  const base = defaults();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<SiteVisibility>;
    return {
      public: { ...base.public, ...(saved.public ?? {}) },
      staff: { ...base.staff, ...(saved.staff ?? {}) },
      account: { ...base.account, ...(saved.account ?? {}) },
    };
  } catch {
    return base;
  }
}

export function getSiteVisibility(): SiteVisibility {
  return read();
}

export function saveSiteVisibility(next: SiteVisibility) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function setVisibilityFlag(surface: VisibilitySurface, id: string, enabled: boolean) {
  const current = read();
  saveSiteVisibility({ ...current, [surface]: { ...current[surface], [id]: enabled } });
}

export function isPublicPageEnabled(id: string, visibility = read()) {
  return visibility.public[id] !== false;
}

export function isStaffModuleEnabled(id: string, visibility = read()) {
  return visibility.staff[id] !== false;
}

export function isAccountPageEnabled(href: string, visibility = read()) {
  return visibility.account[href] !== false;
}

export function publicPageIdForPath(pathname: string): PublicPageId | null {
  const match = publicSitePages
    .slice()
    .sort((a, b) => b.href.length - a.href.length)
    .find((page) => pathname === page.href || pathname.startsWith(`${page.href}/`));
  return match?.id ?? null;
}

export function visiblePublicNav(visibility = read()) {
  return navigation.filter((item) => {
    const page = publicSitePages.find((entry) => entry.href === item.href);
    return page ? isPublicPageEnabled(page.id, visibility) : true;
  });
}

export function visibleAccountNav(visibility = read()) {
  return accountNavigation.filter((item) => isAccountPageEnabled(item.href, visibility));
}

export function subscribeSiteVisibility(onChange: () => void) {
  return subscribeCms(onChange);
}
