import { slugify, subscribeCms } from "@/lib/cms";

const KEY = "vgmf_cms_pages";

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  enabled: boolean;
  showInNav: boolean;
  showInFooter: boolean;
  updatedAt: string;
};

function read(): CmsPage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CmsPage[]) : [];
  } catch {
    return [];
  }
}

function write(pages: CmsPage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(pages));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function getCmsPages() {
  return read().sort((a, b) => a.title.localeCompare(b.title));
}

export function getLiveCmsPages() {
  return getCmsPages().filter((page) => page.enabled);
}

export function getCmsPageBySlug(slug: string) {
  return getCmsPages().find((page) => page.slug === slug) ?? null;
}

export function saveCmsPage(input: Partial<CmsPage> & { title: string }) {
  const pages = read();
  const id = input.id || `page-${Date.now()}`;
  const slugBase = slugify(input.slug || input.title);
  let slug = slugBase;
  let n = 2;
  while (pages.some((page) => page.slug === slug && page.id !== id)) {
    slug = `${slugBase}-${n}`;
    n += 1;
  }
  const next: CmsPage = {
    id,
    slug,
    title: input.title.trim(),
    excerpt: (input.excerpt ?? "").trim(),
    body: input.body ?? "",
    enabled: input.enabled ?? false,
    showInNav: input.showInNav ?? false,
    showInFooter: input.showInFooter ?? true,
    updatedAt: new Date().toISOString(),
  };
  write([...pages.filter((page) => page.id !== id), next]);
  return next;
}

export function deleteCmsPage(id: string) {
  write(read().filter((page) => page.id !== id));
}

export function subscribeCmsPages(onChange: () => void) {
  return subscribeCms(onChange);
}
