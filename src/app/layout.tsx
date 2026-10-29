import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import JsonLd from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/constants";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans-body",
  subsets: ["latin"],
  display: "swap",
});

const serif = Source_Serif_4({
  variable: "--font-serif-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
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
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: "Capture Visual Studios",
  publisher: siteConfig.name,
  category: "education",
  applicationName: siteConfig.shortName,
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: siteConfig.url },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteConfig.url,
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

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-IN"
      className={`${sans.variable} ${serif.variable} scroll-smooth`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <JsonLd />
        {children}
      </body>
    </html>
  );
}