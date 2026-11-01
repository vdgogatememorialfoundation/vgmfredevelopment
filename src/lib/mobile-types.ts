import type { MobileAppearance } from "@/lib/mobile-appearance";
import type { MobileAppConfig } from "@/lib/mobile-config";
import type { PlatformCountries } from "@/lib/platform-countries";
import type { SiteText } from "@/lib/site-text";
import type { Announcement, Article, Book, Clinic, Event, FAQItem, Flyer, Notice, Review, SeminarReview, SocialLinks, Video } from "@/types";

export type MobileFeed = {
  publishedAt: string;
  site: {
    name: string;
    tagline: string;
    logoUrl?: string;
    logoText?: string;
    faviconUrl?: string;
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
  flyers: Flyer[];
  gallery: { id: string; src: string; title: string; caption?: string; category: string; date?: string }[];
  about: {
    title?: string;
    intro?: string;
    sections?: { title: string; body: string }[];
  } | null;
  policies: Record<string, { title?: string; description?: string; sections?: { title: string; body: string }[] }>;
  faqs: FAQItem[];
  appearance?: MobileAppearance | null;
  platformCountries?: PlatformCountries;
  seminarReviews?: SeminarReview[];
  productReviews?: Review[];
  siteText?: SiteText;
};
