import { siteConfig } from "@/lib/constants";

export const siteUrl = siteConfig.url;

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
  "/about/history",
  "/about/legacy-of-vaidya-rb-gogate",
  "/notices",
  "/events",
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
  "/certificate-verification",
];
