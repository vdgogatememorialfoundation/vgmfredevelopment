import type { Metadata } from "next";
import { events } from "@/data/events";
import { LiveEventPage } from "@/components/events/LiveEvents";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { isPublishedNow } from "@/lib/schedule";
import { siteConfig } from "@/lib/constants";
import { absoluteUrl, breadcrumbJsonLd, plainText } from "@/lib/seo";
import { StructuredData } from "@/components/seo/StructuredData";

export const revalidate = 300;

function findEvent(slug: string) {
  return (readMobileFeed().events ?? []).find((item) => item.slug === slug && isPublishedNow(item)) ?? events.find((item) => item.slug === slug);
}

interface EventDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return events.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: EventDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = findEvent(slug);
  if (!event) return { title: "Event" };
  const description = plainText(event.shortDescription || event.description);
  const url = absoluteUrl(`/events/${event.slug}`);
  const images = event.bannerUrl ? [{ url: absoluteUrl(event.bannerUrl), alt: event.name }] : undefined;
  return {
    title: event.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: event.name, description, siteName: siteConfig.name, ...(images ? { images } : {}) },
    twitter: { card: images ? "summary_large_image" : "summary", title: event.name, description, ...(images ? { images: images.map((image) => image.url) } : {}) },
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug } = await params;
  const event = findEvent(slug);
  const online = event?.mode === "Online";
  return (
    <>
      {event && (
        <StructuredData
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Event",
              name: event.name,
              description: plainText(event.description || event.shortDescription, 500),
              image: event.bannerUrl ? [absoluteUrl(event.bannerUrl)] : undefined,
              startDate: event.startDate,
              endDate: event.endDate || event.startDate,
              eventStatus: "https://schema.org/EventScheduled",
              eventAttendanceMode: online
                ? "https://schema.org/OnlineEventAttendanceMode"
                : event.mode === "Hybrid"
                  ? "https://schema.org/MixedEventAttendanceMode"
                  : "https://schema.org/OfflineEventAttendanceMode",
              location: online
                ? { "@type": "VirtualLocation", url: absoluteUrl(`/events/${event.slug}`) }
                : {
                    "@type": "Place",
                    name: event.venue || event.city || "Pune",
                    address: { "@type": "PostalAddress", addressLocality: event.city || "Pune", addressCountry: "IN" },
                  },
              organizer: { "@id": `${absoluteUrl("/")}#organization` },
              offers: {
                "@type": "Offer",
                url: event.registrationUrl || absoluteUrl(`/events/${event.slug}`),
                price: event.fee ?? 0,
                priceCurrency: event.currency || "INR",
                availability: event.registrationStatus === "Open" || event.registrationStatus === "Closing Soon" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
              },
            },
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Events", path: "/events" },
              { name: event.name, path: `/events/${event.slug}` },
            ]),
          ]}
        />
      )}
      <LiveEventPage slug={slug} />
    </>
  );
}
