import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
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
  metadataBase: new URL("https://vaidyagogate.org"),
  title: {
    default: "Vaidya Gogate Memorial Foundation",
    template: "%s | Vaidya Gogate Memorial Foundation",
  },
  description: "Preserving Ayurveda. Advancing Knowledge. Serving Society.",
  keywords: ["Vaidya Gogate", "Ayurveda", "Foundation", "Memorial", "Education", "Events", "Books", "Publications"],
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
  themeColor: "#1A2332",
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
        {children}
      </body>
    </html>
  );
}