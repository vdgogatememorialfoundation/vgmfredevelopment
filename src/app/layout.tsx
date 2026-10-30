import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Outfit,
} from "next/font/google";
import JsonLd from "@/components/seo/JsonLd";
import { EnvironmentBanner } from "@/components/layout/EnvironmentBanner";
import { platformEnv, publicSiteUrl } from "@/lib/platform";
import { siteConfig } from "@/lib/constants";
import "./globals.css";

const sans = Outfit({
  variable: "--font-sans-body",
  subsets: ["latin"],
  display: "swap",
});

const serif = Fraunces({
  variable: "--font-serif-display",
  subsets: ["latin"],
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const kannada = Noto_Sans_Kannada({
  variable: "--font-kannada",
  subsets: ["kannada"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const tamil = Noto_Sans_Tamil({
  variable: "--font-tamil",
  subsets: ["tamil"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const malayalam = Noto_Sans_Malayalam({
  variable: "--font-malayalam",
  subsets: ["malayalam"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const gujarati = Noto_Sans_Gujarati({
  variable: "--font-gujarati",
  subsets: ["gujarati"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export function generateMetadata(): Metadata {
  const url = publicSiteUrl();
  const hosted = platformEnv();
  const noIndex = hosted === "demo" || hosted === "staging";
  return {
    metadataBase: new URL(url),
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.tagline,
    keywords: [
      "Vaidya Gogate Memorial Foundation",
      "Ayurveda",
      "Pune",
      "Ayurveda education",
      "Ayurveda seminars",
      "Ayurveda publications",
      "Ayurveda clinics",
      "VGMF",
    ],
    authors: [{ name: siteConfig.name, url }],
    creator: "Capture Visual Studios",
    publisher: siteConfig.name,
    category: "education",
    applicationName: siteConfig.shortName,
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url,
      siteName: siteConfig.name,
      title: siteConfig.name,
      description: siteConfig.tagline,
      images: [
        {
          url: "/images/og-image.jpg",
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.name,
      description: siteConfig.tagline,
      images: ["/images/og-image.jpg"],
    },
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-IN"
      className={`${sans.variable} ${serif.variable} ${devanagari.variable} ${kannada.variable} ${tamil.variable} ${malayalam.variable} ${gujarati.variable} scroll-smooth`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <EnvironmentBanner />
        <JsonLd />
        {children}
      </body>
    </html>
  );
}