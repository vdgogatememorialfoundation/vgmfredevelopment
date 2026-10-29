import type { MobileAppConfig } from "@/lib/mobile-config";
import type { Announcement, Article, Book, Clinic, Event, FAQItem, Notice, SocialLinks, Video } from "@/types";

export type MobileFeed = {
  publishedAt: string;
  site: {
    name: string;
    tagline: string;
    logoUrl?: string;
    email: string;
    phone: string;
    address: string;
    social?: SocialLinks;
  };
  flags: {
    supportUs: boolean;
    supportUsTitle: string;
    supportUsText: string;
    supportUsHref: string;
  };
  visibility: Record<string, boolean>;
  mobile: MobileAppConfig;
  events: Event[];
  articles: Article[];
  books: Book[];
  clinics: Clinic[];
  videos: Video[];
  notices: Notice[];
  announcements: Announcement[];
  gallery: { id: string; src: string; title: string; caption?: string; category: string; date?: string }[];
  about: {
    title?: string;
    intro?: string;
    sections?: { title: string; body: string }[];
  } | null;
  policies: Record<string, { title?: string; description?: string; sections?: { title: string; body: string }[] }>;
  faqs: FAQItem[];
};
