import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/common/Badge";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import RequireAuth from "@/components/auth/RequireAuth";
import { seminarSiteUrl } from "@/lib/constants";
import { getEvents } from "@/lib/server/content";
import {
  eventDays,
  formatCurrency,
  formatDate,
  formatDateRange,
} from "@/lib/utils";

interface EventDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: EventDetailPageProps): Promise<Metadata> {
  const events = await getEvents();
  const { slug } = await params;
  const event = events.find((item) => item.slug === slug);

  if (!event) return {};

  return {
    title: event.name,
    description: event.shortDescription,
  };
}

export default async function EventDetailPage({
  params,
}: EventDetailPageProps) {
  const events = await getEvents();
  const { slug } = await params;
  const event = events.find((item) => item.slug === slug);

  if (!event) {
    notFound();
  }

  const days = eventDays(event.startDate, event.endDate);

  return (
    <RequireAuth message="Sign in to view full event details, flyers and register for events.">
      <main>
        <section className="border-b border-border bg-warm-cream">
          <div className="container py-10">
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                <li>
                  <Link href="/" className="transition hover:text-burgundy">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/events" className="transition hover:text-burgundy">
                    Events
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <span className="font-medium text-text-primary">
                    {event.name}
                  </span>
                </li>
              </ol>
            </nav>

            <div className="flex flex-wrap gap-3">
              <Badge tone="burgundy">{event.eventType}</Badge>
              <Badge
                tone={
                  event.registrationStatus === "Open"
                    ? "success"
                    : event.registrationStatus === "Closed"
                      ? "neutral"
                      : "warning"
                }
              >
                Registration {event.registrationStatus}
              </Badge>
            </div>

            <h1 className="heading-1 mt-4">{event.name}</h1>
            <p className="mt-5 max-w-3xl text-body-lg">
              {event.shortDescription}
            </p>

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm text-text-muted">
              <span className="flex items-center gap-2">
                <CalendarIcon />
                {formatDateRange(event.startDate, event.endDate)}
              </span>
              {days > 1 && (
                <span className="flex items-center gap-2">
                  <ClockIcon />
                  {days} days
                </span>
              )}
              {event.venue || event.city ? (
                <span className="flex items-center gap-2">
                  <PinIcon />
                  {[event.venue, event.city].filter(Boolean).join(", ")}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="section bg-background">
          <div className="container grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MediaPlaceholder
                variant="event"
                label={event.name}
                src={event.bannerUrl}
                aspectClassName="aspect-[16/9] rounded-2xl"
              />

              {event.flyers && event.flyers.length > 0 && (
                <FlyerGallery flyers={event.flyers} />
              )}

              <div className="mt-10">
                <h2 className="heading-3 mb-4">About the Event</h2>
                <p className="text-body">{event.description}</p>
              </div>

              {event.highlights && (
                <div className="mt-10">
                  <h2 className="heading-3 mb-4">Highlights</h2>
                  <ul className="grid gap-3 sm:grid-cols-2" role="list">
                    {event.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="flex items-start gap-3 rounded-xl border border-border bg-white p-4"
                      >
                        <span className="mt-0.5 text-burgundy">✓</span>
                        <span className="text-sm text-text-primary">
                          {highlight}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {event.speakers && event.speakers.length > 0 && (
                <div className="mt-10">
                  <h2 className="heading-3 mb-4">Speakers</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {event.speakers.map((speaker) => (
                      <div
                        key={speaker.id}
                        className="rounded-2xl border border-border bg-white p-5"
                      >
                        <p className="font-semibold text-text-primary">
                          {speaker.name}
                        </p>
                        <p className="mt-1 text-sm text-burgundy">
                          {speaker.designation}
                        </p>
                        <p className="mt-2 text-sm text-text-muted">
                          {speaker.topic}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {event.schedule && event.schedule.length > 0 && (
                <div className="mt-10">
                  <h2 className="heading-3 mb-4">Schedule</h2>
                  <ol className="space-y-4" role="list">
                    {event.schedule.map((item) => (
                      <li
                        key={item.id}
                        className="flex gap-4 rounded-2xl border border-border bg-white p-5"
                      >
                        <div className="flex h-10 w-24 shrink-0 items-center justify-center rounded-lg bg-burgundy/10 text-xs font-semibold text-burgundy">
                          {item.time}
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary">
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="mt-1 text-sm text-text-muted">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {event.faqs && event.faqs.length > 0 && (
                <div className="mt-10">
                  <h2 className="heading-3 mb-4">Frequently Asked Questions</h2>
                  <div className="space-y-4">
                    {event.faqs.map((faq) => (
                      <div
                        key={faq.question}
                        className="rounded-2xl border border-border bg-white p-6"
                      >
                        <p className="font-semibold text-text-primary">
                          {faq.question}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-text-muted">
                          {faq.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {event.terms && event.terms.length > 0 && (
                <section
                  className="mt-10 scroll-mt-28"
                  id="terms"
                  aria-labelledby="terms-heading"
                >
                  <h2
                    id="terms-heading"
                    className="heading-3 mb-4"
                  >
                    Terms &amp; Conditions
                  </h2>
                  <ol
                    className="list-decimal space-y-3 pl-5 text-sm leading-6 text-text-primary marker:text-burgundy"
                    role="list"
                  >
                    {event.terms.map((term, index) => (
                      <li key={index}>{term}</li>
                    ))}
                  </ol>
                </section>
              )}
            </div>

            <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                  Details
                </h2>

                <dl className="mt-5 space-y-4 text-sm">
                  <div>
                    <dt className="text-text-muted">Dates</dt>
                    <dd className="mt-1 font-medium text-text-primary">
                      {formatDateRange(event.startDate, event.endDate)}
                    </dd>
                  </div>

                  {days > 1 && (
                    <div>
                      <dt className="text-text-muted">Duration</dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {days}-day programme
                      </dd>
                    </div>
                  )}

                  <div>
                    <dt className="text-text-muted">Registration Opens</dt>
                    <dd className="mt-1 font-medium text-text-primary">
                      {formatDate(event.registrationStart)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-text-muted">Registration Closes</dt>
                    <dd className="mt-1 font-medium text-text-primary">
                      {formatDate(event.registrationEnd)}
                    </dd>
                  </div>

                  {event.venue && (
                    <div>
                      <dt className="text-text-muted">Venue</dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {event.venue}
                      </dd>
                    </div>
                  )}

                  {event.city && (
                    <div>
                      <dt className="text-text-muted">Location</dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {event.city}
                      </dd>
                    </div>
                  )}

                  <div>
                    <dt className="text-text-muted">Mode</dt>
                    <dd className="mt-1 font-medium text-text-primary">
                      {event.mode}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-text-muted">Fee</dt>
                    <dd className="mt-1 font-semibold text-burgundy">
                      {formatCurrency(event.fee, event.currency)}
                    </dd>
                  </div>

                  {event.capacity && (
                    <div>
                      <dt className="text-text-muted">Capacity</dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {event.capacity} seats
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-2xl border border-burgundy/20 bg-burgundy/5 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-burgundy">
                  Registration
                </p>
                <p className="mt-2 text-sm text-text-muted">
                  Registrations for this event are handled on the official
                  seminar website. Click below to visit the seminar site and
                  complete your registration there.
                </p>
                <Link
                  href={seminarSiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-5 w-full"
                >
                  Register on Seminar Website
                </Link>
                <p className="mt-3 text-center text-xs text-text-muted">
                  You will be redirected to {seminarSiteUrl.replace("https://", "")}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </RequireAuth>
  );
}

function FlyerGallery({ flyers }: { flyers: string[] }) {
  return (
    <div className="mt-10">
      <h2 className="heading-3 mb-4">Flyers</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {flyers.map((flyer, index) => (
          <MediaPlaceholder
            key={index}
            variant="event"
            label={`Flyer ${index + 1}`}
            src={flyer}
            aspectClassName="aspect-[3/4] rounded-2xl"
          />
        ))}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}