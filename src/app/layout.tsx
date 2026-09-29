import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
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
  themeColor: "#651C1C",
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
      className={`${baloo.variable} scroll-smooth`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}