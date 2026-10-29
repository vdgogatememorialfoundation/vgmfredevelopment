import { getAbout } from "@/lib/about";
import { getFaqs, getSettings } from "@/lib/admin-store";
import {
  getLiveAnnouncements,
  getLiveClinics,
  getLiveEvents,
  getLiveNotices,
  getLiveVideos,
  getPublishedArticles,
  getSiteFlags,
} from "@/lib/cms";
import { siteConfig } from "@/lib/constants";
import { getGallery } from "@/lib/gallery";
import { defaultMobileAppConfig, getMobileAppConfig, type MobileAppConfig } from "@/lib/mobile-config";
import { getPolicies } from "@/lib/policies";
import { getLiveBooks } from "@/lib/product-data";
import { getSiteVisibility } from "@/lib/site-visibility";
import type { MobileFeed } from "@/lib/mobile-types";

/** Assemble the public app feed from the admin CMS in this browser. */
export function collectMobileSnapshot(): MobileFeed {
  const settings = getSettings();
  return {
    publishedAt: new Date().toISOString(),
    site: {
      name: settings.siteName || siteConfig.name,
      tagline: settings.tagline || siteConfig.tagline,
      logoUrl: settings.logoUrl || "",
      email: settings.supportEmail || siteConfig.email,
      phone: settings.supportPhone || siteConfig.phone,
      address: siteConfig.address,
      social: settings.social ?? siteConfig.social,
    },
    flags: getSiteFlags(),
    visibility: getSiteVisibility().public,
    mobile: getMobileAppConfig(),
    events: getLiveEvents(),
    articles: getPublishedArticles(),
    books: getLiveBooks().filter((book) => book.active !== false),
    clinics: getLiveClinics(),
    videos: getLiveVideos(),
    notices: getLiveNotices(),
    announcements: getLiveAnnouncements(),
    gallery: getGallery(),
    about: getAbout(),
    policies: getPolicies(),
    faqs: getFaqs().filter((item) => item.active !== false),
  };
}

export function emptyFeedFallback(mobile: MobileAppConfig = defaultMobileAppConfig): MobileFeed {
  return {
    publishedAt: "",
    site: {
      name: siteConfig.name,
      tagline: siteConfig.tagline,
      logoUrl: "",
      email: siteConfig.email,
      phone: siteConfig.phone,
      address: siteConfig.address,
      social: siteConfig.social,
    },
    flags: { supportUs: false, supportUsTitle: "Support the Foundation", supportUsText: "", supportUsHref: "/contact" },
    visibility: {},
    mobile,
    events: [],
    articles: [],
    books: [],
    clinics: [],
    videos: [],
    notices: [],
    announcements: [],
    gallery: [],
    about: null,
    policies: {},
    faqs: [],
  };
}
