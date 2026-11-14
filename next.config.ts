import type { NextConfig } from "next";

const onVercel = process.env.VERCEL === "1";

/** Old Wix URLs from www.vaidyagogate.org, kept so search results and shared links land on the new pages. */
const wixArticle: Record<string, string> = {
  hiv: "hiv",
  "hiv-chikitsa": "hiv",
  "swine-flu": "h1n1",
  arbud: "tumour",
  sangyaharan: "sangyaharan-an-ayurvedic-concept",
  "office-procedures": "office-procedures-and-cost-effective-treatment-in-shalakyatantra",
  raktamokshana: "raktamokshan",
  agnikarma: "agnikarma",
  "agnikarma-shalaka": "agnikarma-shalaka",
  "types-of-agnikarma": "types-of-agnikarma",
  "instruments-and-requirements": "instruments-for-agnikarma-and-viddhakarma",
  "viddhakarma-and-chinese-medicine": "viddhakarma-and-it-s-correlation-with-chinese-medicine",
  "viddhakarma-points": "viddhakarma-points-1",
  "viddhakarma-points2": "viddhakarma-points-2",
  "viddhakarma-points-3": "viddhakarma-points-3",
  "viddhakarma-points-4": "viddhakarma-points-4",
  "shalkya-tantra-at-a-glance": "shalakya-tantra-at-a-glance",
  "ayurved-outdated-not-at-all-2": "2",
  "ayurved-outdated-not-at-all-3": "3",
  "ayurved-outdated-not-at-all-4": "4",
  "ayurved-outdated-not-at-all-5": "5",
  "ayurvedoutdated-not-at-all-6": "6",
};
const wixToArticles = [
  "kayachikitsa", "prasuti-tantra", "shalya-tantra", "shalakya-tantra", "special-articles", "in-conversation",
  "s-projects-basic", "shalya-shoola", "copy-of-shalya-shoola", "sandhivaat", "agni-viddha", "agnikarma-chikitsa",
  "masanumasik-garbhavriddhi", "documents", "dd",
];
const wixRedirects = [
  ...Object.entries(wixArticle).map(([from, to]) => ({ source: `/${from}`, destination: `/articles/${to}`, permanent: true })),
  ...wixToArticles.map((from) => ({ source: `/${from}`, destination: "/articles", permanent: true })),
  { source: "/contact-us", destination: "/contact", permanent: true },
  { source: "/about-us", destination: "/about", permanent: true },
  { source: "/faqs", destination: "/faq", permanent: true },
  { source: "/special-thanks", destination: "/thanks", permanent: true },
  { source: "/fellowship", destination: "https://fellowship.vaidyagogate.org", permanent: true },
  { source: "/fellowship-faq", destination: "https://fellowship.vaidyagogate.org", permanent: true },
  { source: "/seminar-registration-tnc", destination: "https://seminar.vaidyagogate.org", permanent: true },
  { source: "/seminar-submissions", destination: "https://seminar.vaidyagogate.org", permanent: true },
  { source: "/product-page/:slug*", destination: "/shop", permanent: true },
  { source: "/event-details/:slug*", destination: "/events", permanent: true },
];

const nextConfig: NextConfig = {
  // Standalone output is for the Mumbai VPS. Skip it if a leftover Vercel Git hook still runs.
  ...(!onVercel ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["pg"],
  outputFileTracingExcludes: {
    "/*": ["./mobile/**/*", "./native/**/*", "./admin-backups/**/*", "./deploy/**/*"],
  },
  async redirects() {
    return [
      { source: "/videos/seminars", destination: "/account/seminar-videos", permanent: false },
      { source: "/vgmf-foundation.apk", destination: "/apps/vgmf-customer.apk", permanent: false },
      { source: "/api/mobile/apk", destination: "/apps/vgmf-customer.apk", permanent: false },
      ...wixRedirects,
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/staff/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/staff",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/doctor/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/doctor",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/support/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/support",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/apps/:file*.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: "attachment" },
          { key: "Cache-Control", value: "public, max-age=120" },
        ],
      },
    ];
  },
};

export default nextConfig;
