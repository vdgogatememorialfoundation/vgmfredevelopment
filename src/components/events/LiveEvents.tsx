"use client";

import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import EventCard from "@/components/events/EventCard";
import Badge from "@/components/common/Badge";
import { seminarSiteUrl } from "@/lib/constants";
import { useLiveEvents } from "@/lib/use-cms";
import { formatCurrency, formatDateRange } from "@/lib/utils";

export function EventsIndex() {
  const events = useLiveEvents();
  const upcoming = events
    .filter((event) => event.registrationStatus !== "Closed")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = events
    .filter((event) => event.registrationStatus === "Closed")
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <main>
      <PageHeader
        eyebrow="Events"
        title="Events & Programmes"
        description="Seminars, workshops, fellowships and other programmes of the Foundation. Registrations are handled on the official seminar website."
      />
      <section className="section bg-background">
        <div className="container">
          <h2 className="heading-3 mb-8">Upcoming Events</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>
      {past.length > 0 && (
        <section className="section bg-warm-cream">
          <div className="container">
            <h2 className="heading-3 mb-8">Past Events</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {past.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export function LiveEventPage({ slug }: { slug: string }) {
  const events = useLiveEvents();
  const event = events.find((item) => item.slug === slug);
  if (!event) {
    return (
      <main className="container py-20">
        <h1 className="heading-2">Event not published</h1>
        <Link href="/events" className="btn-outline mt-6">All events</Link>
      </main>
    );
  }

  return (
    <main>
      <section className="border-b border-border bg-warm-cream">
        <div className="container py-10">
          <Link href="/events" className="text-sm text-text-muted hover:text-burgundy">Events</Link>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="burgundy">{event.eventType}</Badge>
            <Badge tone="neutral">{event.registrationStatus}</Badge>
          </div>
          <h1 className="heading-1 mt-4">{event.name}</h1>
          <p className="mt-4 max-w-3xl text-body">{event.shortDescription}</p>
          <p className="mt-4 text-sm font-semibold text-burgundy">
            {formatDateRange(event.startDate, event.endDate)}
            {event.city ? ` · ${event.city}` : ""}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
        </div>
      </section>
      <section className="section bg-background">
        <div className="container grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <p className="text-body whitespace-pre-line">{event.description}</p>
            {event.speakers && event.speakers.length > 0 && (
              <div>
                <h2 className="heading-3">Speakers</h2>
                <ul className="mt-4 space-y-3">
                  {event.speakers.map((speaker) => (
                    <li key={speaker.id} className="rounded-xl border border-border bg-white p-4">
                      <p className="font-semibold">{speaker.name}</p>
                      <p className="text-sm text-text-muted">{speaker.designation} · {speaker.topic}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <aside className="rounded-2xl border border-border bg-white p-6">
            <p className="text-sm text-text-muted">Registration fee</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">{formatCurrency(event.fee, event.currency)}</p>
            <a href={seminarSiteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 w-full">
              Register on the seminar site
            </a>
            <Link href="/certificate-verification" className="btn-outline mt-3 w-full">
              Verify a certificate
            </Link>
            <p className="mt-3 text-xs leading-5 text-text-muted">
              seminar.vaidyagogate.org confirms certificates through the Foundation verification API.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
