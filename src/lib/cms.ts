import { articles as seededArticles } from "@/data/articles";
import { clinics as seededClinics } from "@/data/clinics";
import { announcements as seededAnnouncements, flyers as seededFlyers, notices as seededNotices } from "@/data/content";
import { events as seededEvents } from "@/data/events";
import { videos as seededVideos } from "@/data/videos";
import type { Announcement, Article, Clinic, Event, EventMode, EventType, Flyer, Notice, RegistrationStatus, Video } from "@/types";

const ARTICLES_KEY = "vgmf_article_edits";
const CUSTOM_ARTICLES_KEY = "vgmf_custom_articles";
const ANNOUNCEMENTS_KEY = "vgmf_announcement_edits";
const EVENTS_KEY = "vgmf_event_edits";
const FLAGS_KEY = "vgmf_site_flags";
const ACCESS_KEY = "vgmf_module_access";

export const contentModules = [
  { id: "articles", label: "Articles" },
  { id: "events", label: "Events" },
  { id: "announcements", label: "Announcements" },
  { id: "orders", label: "Orders & refunds" },
  { id: "certificates", label: "Certificates" },
  { id: "clinic", label: "Clinic" },
] as const;

export type ContentModuleId = (typeof contentModules)[number]["id"];

export type SiteFlags = {
  supportUs: boolean;
  supportUsTitle: string;
  supportUsText: string;
  supportUsHref: string;
};

export const defaultFlags: SiteFlags = {
  supportUs: false,
  supportUsTitle: "Support the Foundation",
  supportUsText: "Contributions help clinics, teaching and publications continue.",
  supportUsHref: "/contact",
};

type ArticleEdit = Partial<Article> & { id: string; hidden?: boolean };
type AnnouncementEdit = Partial<Announcement> & { id: string; hidden?: boolean };
type EventEdit = Partial<Event> & { id: string; hidden?: boolean };

const ADMIN_EMAIL = "admin@vaidyagogate.org";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function subscribeCms(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("vgmf-cms", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("vgmf-cms", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return slug || `item-${Date.now()}`;
}

export function getSiteFlags(): SiteFlags {
  const saved = readJSON<Partial<SiteFlags> | null>(FLAGS_KEY, null);
  if (!saved) return defaultFlags;
  return { ...defaultFlags, ...saved, supportUs: Boolean(saved.supportUs) };
}

export function saveSiteFlags(flags: SiteFlags) {
  writeJSON(FLAGS_KEY, flags);
}

export function getLiveArticles(): Article[] {
  const edits = readJSON<ArticleEdit[]>(ARTICLES_KEY, []);
  const custom = readJSON<Article[]>(CUSTOM_ARTICLES_KEY, []);
  if (!edits.length && !custom.length) return seededArticles;
  const byId = new Map(edits.map((edit) => [edit.id, edit]));
  const fromSeed = seededArticles
    .map((article) => ({ ...article, ...byId.get(article.id) }))
    .filter((article) => !byId.get(article.id)?.hidden);
  const seedIds = new Set(seededArticles.map((article) => article.id));
  return [...custom.filter((article) => !seedIds.has(article.id) && !byId.get(article.id)?.hidden), ...fromSeed];
}

export function getArticle(idOrSlug: string) {
  return getLiveArticles().find((article) => article.id === idOrSlug || article.slug === idOrSlug);
}

export function saveArticle(article: Article) {
  const isSeed = seededArticles.some((item) => item.id === article.id);
  if (isSeed) {
    const edits = readJSON<ArticleEdit[]>(ARTICLES_KEY, []).filter((item) => item.id !== article.id);
    edits.push({
      id: article.id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      author: article.author,
      category: article.category,
      featured: article.featured,
      hidden: false,
    });
    writeJSON(ARTICLES_KEY, edits);
    return;
  }
  const custom = readJSON<Article[]>(CUSTOM_ARTICLES_KEY, []).filter((item) => item.id !== article.id);
  custom.unshift(article);
  writeJSON(CUSTOM_ARTICLES_KEY, custom);
}

export function hideArticle(id: string) {
  const edits = readJSON<ArticleEdit[]>(ARTICLES_KEY, []).filter((item) => item.id !== id);
  edits.push({ id, hidden: true });
  writeJSON(ARTICLES_KEY, edits);
  const custom = readJSON<Article[]>(CUSTOM_ARTICLES_KEY, []).filter((item) => item.id !== id);
  writeJSON(CUSTOM_ARTICLES_KEY, custom);
}

export function getLiveAnnouncements(): Announcement[] {
  const edits = readJSON<AnnouncementEdit[]>(ANNOUNCEMENTS_KEY, []);
  const custom = readJSON<Announcement[]>("vgmf_custom_announcements", []);
  if (!edits.length && !custom.length) return seededAnnouncements;
  const byId = new Map(edits.map((edit) => [edit.id, edit]));
  const fromSeed = seededAnnouncements
    .map((item) => ({ ...item, ...byId.get(item.id) }))
    .filter((item) => !byId.get(item.id)?.hidden);
  const seedIds = new Set(seededAnnouncements.map((item) => item.id));
  return [...custom.filter((item) => !seedIds.has(item.id)), ...fromSeed];
}

export function saveAnnouncement(item: Announcement) {
  const isSeed = seededAnnouncements.some((announcement) => announcement.id === item.id);
  if (isSeed) {
    const edits = readJSON<AnnouncementEdit[]>(ANNOUNCEMENTS_KEY, []).filter((edit) => edit.id !== item.id);
    edits.push({ ...item, hidden: false });
    writeJSON(ANNOUNCEMENTS_KEY, edits);
    return;
  }
  const custom = readJSON<Announcement[]>("vgmf_custom_announcements", []).filter((announcement) => announcement.id !== item.id);
  custom.unshift(item);
  writeJSON("vgmf_custom_announcements", custom);
}

export function hideAnnouncement(id: string) {
  const edits = readJSON<AnnouncementEdit[]>(ANNOUNCEMENTS_KEY, []).filter((edit) => edit.id !== id);
  edits.push({ id, hidden: true });
  writeJSON(ANNOUNCEMENTS_KEY, edits);
  const custom = readJSON<Announcement[]>("vgmf_custom_announcements", []).filter((item) => item.id !== id);
  writeJSON("vgmf_custom_announcements", custom);
}

export function getLiveEvents(): Event[] {
  const edits = readJSON<EventEdit[]>(EVENTS_KEY, []);
  const custom = readJSON<Event[]>("vgmf_custom_events", []);
  if (!edits.length && !custom.length) return seededEvents;
  const byId = new Map(edits.map((edit) => [edit.id, edit]));
  const fromSeed = seededEvents
    .map((event) => ({ ...event, ...byId.get(event.id) }))
    .filter((event) => !byId.get(event.id)?.hidden);
  const seedIds = new Set(seededEvents.map((event) => event.id));
  return [...custom.filter((event) => !seedIds.has(event.id)), ...fromSeed];
}

export function getLiveEvent(slug: string) {
  return getLiveEvents().find((event) => event.slug === slug);
}

export function saveEvent(event: Event) {
  const isSeed = seededEvents.some((item) => item.id === event.id);
  if (isSeed) {
    const edits = readJSON<EventEdit[]>(EVENTS_KEY, []).filter((edit) => edit.id !== event.id);
    edits.push({
      id: event.id,
      name: event.name,
      slug: event.slug,
      shortDescription: event.shortDescription,
      description: event.description,
      fee: event.fee,
      registrationStatus: event.registrationStatus,
      startDate: event.startDate,
      endDate: event.endDate,
      city: event.city,
      venue: event.venue,
      hidden: false,
    });
    writeJSON(EVENTS_KEY, edits);
    return;
  }
  const custom = readJSON<Event[]>("vgmf_custom_events", []).filter((item) => item.id !== event.id);
  custom.unshift(event);
  writeJSON("vgmf_custom_events", custom);
}

export function blankEvent(name: string): Event {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `evt-${Date.now()}`,
    name,
    slug: slugify(name),
    shortDescription: "",
    description: "",
    bannerUrl: "",
    startDate: today,
    endDate: today,
    city: "Pune",
    venue: "",
    mode: "Offline" as EventMode,
    eventType: "Seminar" as EventType,
    registrationStart: today,
    registrationEnd: today,
    fee: 0,
    currency: "INR",
    registrationStatus: "Open" as RegistrationStatus,
  };
}

export function getModuleAccess(): Record<ContentModuleId, string[]> {
  const saved = readJSON<Partial<Record<ContentModuleId, string[]>>>(ACCESS_KEY, {});
  return {
    articles: saved.articles ?? [],
    events: saved.events ?? [],
    announcements: saved.announcements ?? [],
    orders: saved.orders ?? [],
    certificates: saved.certificates ?? [],
    clinic: saved.clinic ?? [],
  };
}

export function saveModuleAccess(access: Record<ContentModuleId, string[]>) {
  writeJSON(ACCESS_KEY, access);
}

export function editorsFor(moduleId: ContentModuleId) {
  const extras = getModuleAccess()[moduleId] ?? [];
  return [ADMIN_EMAIL, ...extras.filter((email) => email.toLowerCase() !== ADMIN_EMAIL)];
}

export function canEdit(moduleId: ContentModuleId, email: string) {
  return editorsFor(moduleId).some((item) => item.toLowerCase() === email.trim().toLowerCase());
}

type Identified = { id: string };

export function liveRecords<T extends Identified>(seed: T[], editsKey: string, customKey: string): T[] {
  const edits = readJSON<(Partial<T> & { id: string; hidden?: boolean })[]>(editsKey, []);
  const custom = readJSON<T[]>(customKey, []);
  if (!edits.length && !custom.length) return seed;
  const byId = new Map(edits.map((edit) => [edit.id, edit]));
  const fromSeed = seed
    .map((item) => ({ ...item, ...byId.get(item.id) }))
    .filter((item) => !byId.get(item.id)?.hidden);
  const seedIds = new Set(seed.map((item) => item.id));
  return [...custom.filter((item) => !seedIds.has(item.id) && !byId.get(item.id)?.hidden), ...fromSeed];
}

export function saveRecord<T extends Identified>(seed: T[], editsKey: string, customKey: string, record: T) {
  const isSeed = seed.some((item) => item.id === record.id);
  if (isSeed) {
    const edits = readJSON<(Partial<T> & { id: string; hidden?: boolean })[]>(editsKey, []).filter((edit) => edit.id !== record.id);
    edits.push({ ...record, hidden: false });
    writeJSON(editsKey, edits);
    return;
  }
  const custom = readJSON<T[]>(customKey, []).filter((item) => item.id !== record.id);
  custom.unshift(record);
  writeJSON(customKey, custom);
}

export function hideRecord(editsKey: string, customKey: string, id: string) {
  const edits = readJSON<{ id: string; hidden?: boolean }[]>(editsKey, []).filter((edit) => edit.id !== id);
  edits.push({ id, hidden: true });
  writeJSON(editsKey, edits);
  const custom = readJSON<Identified[]>(customKey, []).filter((item) => item.id !== id);
  writeJSON(customKey, custom);
}

export const noticeKeys = { edits: "vgmf_notice_edits", custom: "vgmf_custom_notices" };
export const flyerKeys = { edits: "vgmf_flyer_edits", custom: "vgmf_custom_flyers" };
export const videoKeys = { edits: "vgmf_video_edits", custom: "vgmf_custom_videos" };
export const clinicKeys = { edits: "vgmf_clinic_edits", custom: "vgmf_custom_clinics" };

export const getLiveNotices = () => liveRecords(seededNotices, noticeKeys.edits, noticeKeys.custom);
export const saveNotice = (record: Notice) => saveRecord(seededNotices, noticeKeys.edits, noticeKeys.custom, record);
export const hideNotice = (id: string) => hideRecord(noticeKeys.edits, noticeKeys.custom, id);

export const getLiveFlyers = () => liveRecords(seededFlyers, flyerKeys.edits, flyerKeys.custom);
export const saveFlyer = (record: Flyer) => saveRecord(seededFlyers, flyerKeys.edits, flyerKeys.custom, record);
export const hideFlyer = (id: string) => hideRecord(flyerKeys.edits, flyerKeys.custom, id);

export const getLiveVideos = () => liveRecords(seededVideos, videoKeys.edits, videoKeys.custom);
export const saveVideo = (record: Video) => saveRecord(seededVideos, videoKeys.edits, videoKeys.custom, record);
export const hideVideo = (id: string) => hideRecord(videoKeys.edits, videoKeys.custom, id);

export const getLiveClinics = () => liveRecords(seededClinics, clinicKeys.edits, clinicKeys.custom);
export const saveClinic = (record: Clinic) => saveRecord(seededClinics, clinicKeys.edits, clinicKeys.custom, record);
export const hideClinic = (id: string) => hideRecord(clinicKeys.edits, clinicKeys.custom, id);
