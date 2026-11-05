import type { OrderSettings } from "@/lib/integrations";
import type { MobileAppearance } from "@/lib/mobile-appearance";
import type { MobileAppConfig } from "@/lib/mobile-config";
import type { PlatformCountries } from "@/lib/platform-countries";
import type { SiteText } from "@/lib/site-text";
import type { Announcement, Article, Book, Clinic, Event, FAQItem, Flyer, Notice, PrizeAward, Review, SeminarReview, SiteBanner, SocialLinks, ThanksCredit, Video } from "@/types";

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
    tickerSeconds?: number;
    shlokaBar?: boolean;
    shlokas?: string[];
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
  banners?: SiteBanner[];
  awards?: PrizeAward[];
  thanks?: ThanksCredit[];
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
  /** Public checkout rules (cash on delivery, shipping fee, pickup). No secrets. */
  orderSettings?: OrderSettings;
};
