import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Tiro_Devanagari_Sanskrit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const sanskrit = Tiro_Devanagari_Sanskrit({
  variable: "--font-tiro",
  subsets: ["devanagari", "latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vaidyagogate.org"),
  title: {
    default: "Vaidya Gogate Memorial Foundation",
    template: "%s | Vaidya Gogate Memorial Foundation",
  },
  description: "Preserving Ayurveda. Advancing Knowledge. Serving Society. A foundation dedicated to Ayurveda, education, research, professional development and the enduring legacy of Vaidya R. B. Gogate.",
  keywords: ["Vaidya Gogate", "Ayurveda", "Foundation", "Memorial", "Education", "Research", "Events", "Seminars", "Books", "Publications"],
  authors: [{ name: "Vaidya Gogate Memorial Foundation" }],
  creator: "Vaidya Gogate Memorial Foundation",
  publisher: "Vaidya Gogate Memorial Foundation",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://vaidyagogate.org",
    siteName: "Vaidya Gogate Memorial Foundation",
    title: "Vaidya Gogate Memorial Foundation",
    description: "Preserving Ayurveda. Advancing Knowledge. Serving Society.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Vaidya Gogate Memorial Foundation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaidya Gogate Memorial Foundation",
    description: "Preserving Ayurveda. Advancing Knowledge. Serving Society.",
    images: ["/images/og-image.jpg"],
  },
  verification: {
    google: "google-site-verification-code",
  },
};

export const viewport: Viewport = {
  themeColor: "#C2410C",
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
      className={`${inter.variable} ${fraunces.variable} ${sanskrit.variable} scroll-smooth`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}