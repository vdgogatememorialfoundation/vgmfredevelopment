import { siteConfig } from "@/lib/constants";
import { configuredSocial } from "@/lib/social";

export const siteUrl = siteConfig.url;
const socialSameAs = configuredSocial(siteConfig.social).map((link) => link.href);

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "NGO",
      "@id": `${siteUrl}/#organization`,
      name: siteConfig.name,
      alternateName: siteConfig.shortName,
      url: siteUrl,
      email: siteConfig.email,
      telephone: siteConfig.phone,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Pune",
        addressRegion: "Maharashtra",
        addressCountry: "IN",
        streetAddress: siteConfig.address,
      },
      description: siteConfig.tagline,
      ...(socialSameAs.length ? { sameAs: socialSameAs } : {}),
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: siteConfig.name,
      description: siteConfig.tagline,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-IN",
    },
  ],
};

export const publicSitemapPaths = [
  "/",
  "/about",
  "/about/foundation",
  "/about/history",
  "/about/legacy-of-vaidya-rb-gogate",
  "/about/dr-anagha-gogate",
  "/about/awards",
  "/thanks",
  "/about/books-and-research",
  "/about/trustees",
  "/events",
  "/gallery",
  "/videos",
  "/articles",
  "/shop",
  "/clinics",
  "/contact",
  "/privacy",
  "/terms",
  "/shipping-policy",
  "/return-policy",
  "/refund-policy",
  "/cancellation-policy",
  "/certificate-verification",
  "/support",
  "/faq",
  "/notices",
  "/announcements",
  "/speakers",
  "/schedules",
  "/books",
];

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function plainText(value = "", max = 160) {
  const text = value.replace(/<[^>]*>/g, " ").replace(/[#*_>`~[\]]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
