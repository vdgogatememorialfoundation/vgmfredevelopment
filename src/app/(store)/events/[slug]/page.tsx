import type { Metadata } from "next";
import { events } from "@/data/events";
import { LiveEventPage } from "@/components/events/LiveEvents";

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
  const event = events.find((item) => item.slug === slug);
  if (!event) return { title: "Event" };
  return { title: event.name, description: event.shortDescription };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug } = await params;
  return <LiveEventPage slug={slug} />;
}
