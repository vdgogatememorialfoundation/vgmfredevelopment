import { cache } from "react";
import { db, isDbConfigured } from "@/lib/server/db";
import { ensureSeeded } from "@/lib/server/cms";
import { announcements, certificates, flyers, notices } from "@/data/content";
import { articles } from "@/data/articles";
import { books } from "@/data/books";
import { clinics } from "@/data/clinics";
import { events } from "@/data/events";
import { videos } from "@/data/videos";
import { faqCategories, galleryItems, homeFaqs, partners, testimonials } from "@/data/site";
import {
  DEFAULT_BANNERS,
  DEFAULT_GENERAL,
  DEFAULT_HOMEPAGE,
  DEFAULT_REGISTRATION,
  type Banner,
  type GeneralSettings,
  type HomepageSettings,
  type RegistrationSettings,
} from "@/lib/cms/defaults";
import type { Announcement, Article, Book, Certificate, Clinic, Event, Flyer, Notice, ScheduleItem, Speaker, Video } from "@/types";

type Data = Record<string, unknown> & { id: string };

const loadCollection = cache(async (collection: string): Promise<Data[] | null> => {
  if (!isDbConfigured()) return null;
  try {
    await ensureSeeded();
    const sql = await db();
    const rows = await sql<{ id: string; data: Record<string, unknown> }[]>`
      select id, data from vgmf.items where collection = ${collection} and status = 'published'
      order by sort_order asc, created_at desc`;
    return rows.map((row) => ({ ...row.data, id: String(row.data.id ?? row.id) }));
  } catch (error) {
    console.error(`[content] ${collection}:`, error);
    return null;
  }
});

async function collection<T>(name: string, fallback: T[]): Promise<T[]> {
  const rows = await loadCollection(name);
  return rows ? (rows as unknown as T[]) : fallback;
}

const loadSetting = cache(async (key: string): Promise<Record<string, unknown> | null> => {
  if (!isDbConfigured()) return null;
  try {
    await ensureSeeded();
    const sql = await db();
    const rows = await sql<{ value: Record<string, unknown> }[]>`select value from vgmf.settings where key = ${key}`;
    return rows[0]?.value ?? null;
  } catch (error) {
    console.error(`[content] setting ${key}:`, error);
    return null;
  }
});

export const getAnnouncements = () => collection<Announcement>("announcements", announcements);
export const getNotices = () => collection<Notice>("notices", notices);
export const getFlyers = () => collection<Flyer>("flyers", flyers);
export const getArticles = () => collection<Article>("articles", articles);
export const getVideos = () => collection<Video>("videos", videos);
export const getClinics = () => collection<Clinic>("clinics", clinics);
export const getProducts = () => collection<Book>("products", books);
export const getTestimonials = () => collection<(typeof testimonials)[number]>("testimonials", testimonials);
export const getGallery = () => collection<(typeof galleryItems)[number]>("gallery", galleryItems);

export async function getPartners(): Promise<string[]> {
  const rows = await loadCollection("partners");
  return rows ? rows.map((r) => String(r.name ?? "")).filter(Boolean) : partners;
}

export interface FaqEntry {
  question: string;
  answer: string;
  category?: string;
  showOnHome?: boolean;
}

export async function getFaqCategories(): Promise<{ title: string; items: FaqEntry[] }[]> {
  const rows = await loadCollection("faqs");
  if (!rows) return faqCategories;
  const map = new Map<string, FaqEntry[]>();
  for (const row of rows as unknown as FaqEntry[]) {
    const key = row.category || "General";
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return [...map.entries()].map(([title, items]) => ({ title, items }));
}

export async function getHomeFaqs(): Promise<FaqEntry[]> {
  const rows = await loadCollection("faqs");
  if (!rows) return homeFaqs;
  return (rows as unknown as FaqEntry[]).filter((f) => f.showOnHome);
}

export async function getEvents(): Promise<Event[]> {
  const rows = await loadCollection("events");
  if (!rows) return events;
  const [speakers, schedule] = await Promise.all([loadCollection("speakers"), loadCollection("schedule")]);
  return (rows as unknown as Event[]).map((event) => ({
    ...event,
    speakers: (speakers ?? []).filter((s) => s.eventSlug === event.slug) as unknown as Speaker[],
    schedule: (schedule ?? []).filter((s) => s.eventSlug === event.slug) as unknown as ScheduleItem[],
  }));
}

export async function getCertificateByNumber(number: string): Promise<Certificate | null> {
  const id = number.trim().toUpperCase();
  if (!isDbConfigured()) {
    return certificates.find((c) => c.certificateNumber.toUpperCase() === id) ?? null;
  }
  try {
    await ensureSeeded();
    const sql = await db();
    const rows = await sql<{ data: Certificate }[]>`select data from vgmf.items where collection = 'certificates'
      and status = 'valid' and upper(data->>'certificateNumber') = ${id} limit 1`;
    return rows[0]?.data ?? null;
  } catch {
    return certificates.find((c) => c.certificateNumber.toUpperCase() === id) ?? null;
  }
}

export async function getBanners(placement: Banner["placement"]): Promise<Banner[]> {
  const all = await collection<Banner>("banners", DEFAULT_BANNERS);
  const today = new Date().toISOString().slice(0, 10);
  return all.filter(
    (b) =>
      b.placement === placement &&
      (!b.startDate || b.startDate <= today) &&
      (!b.endDate || b.endDate >= today)
  );
}

export async function getHomepageSettings(): Promise<HomepageSettings> {
  return { ...DEFAULT_HOMEPAGE, ...((await loadSetting("homepage")) ?? {}) } as HomepageSettings;
}

export async function getGeneralSettings(): Promise<GeneralSettings> {
  return { ...DEFAULT_GENERAL, ...((await loadSetting("general")) ?? {}) } as GeneralSettings;
}

export async function getRegistrationSettings(): Promise<RegistrationSettings> {
  return { ...DEFAULT_REGISTRATION, ...((await loadSetting("registration")) ?? {}) } as RegistrationSettings;
}
