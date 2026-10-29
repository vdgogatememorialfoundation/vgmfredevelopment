"use client";

import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import EventCard from "@/components/events/EventCard";
import Badge from "@/components/common/Badge";
import { collectionHook, useLiveEvents } from "@/lib/use-cms";
import { eventRecordKeys, getEventRecords, type EventRecord } from "@/lib/cms";
import { mapsEmbedUrl } from "@/lib/maps-place";

const speakerKeys = eventRecordKeys("speakers");
const scheduleKeys = eventRecordKeys("schedule");
const useSpeakerRecords = collectionHook<EventRecord>(speakerKeys.edits, speakerKeys.custom, [], () => getEventRecords("speakers"));
const useScheduleRecords = collectionHook<EventRecord>(scheduleKeys.edits, scheduleKeys.custom, [], () => getEventRecords("schedule"));
import { TBA, compareEventDates, eventDateText, eventFeeText, eventPlaceText, eventTimeText } from "@/lib/event-display";
import { RegistrationCountdown } from "@/components/events/RegistrationCountdown";
import { isPublishedNow } from "@/lib/schedule";
import { useScheduleTick } from "@/lib/use-schedule";
import { useI18n } from "@/components/i18n/LanguageProvider";

export function EventsIndex() {
  const { t } = useI18n();
  const now = useScheduleTick();
  const events = useLiveEvents().filter((event) => isPublishedNow(event, now));
  const upcoming = events
    .filter((event) => event.registrationStatus !== "Closed")
    .sort(compareEventDates);
  const past = events
    .filter((event) => event.registrationStatus === "Closed")
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <main>
      <PageHeader
        eyebrow={t("events.eyebrow")}
        title={t("events.title")}
        description={t("events.desc")}
      />
      <section className="section bg-background">
        <div className="container">
          <h2 className="heading-3 mb-8">{t("events.upcoming")}</h2>
          {upcoming.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-muted">
              {t("events.empty")}
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>
      {past.length > 0 && (
        <section className="section bg-warm-cream">
          <div className="container">
            <h2 className="heading-3 mb-8">{t("events.past")}</h2>
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
  const { t } = useI18n();
  const now = useScheduleTick();
  const events = useLiveEvents();
  const speakerRecords = useSpeakerRecords();
  const scheduleRecords = useScheduleRecords();
  const found = events.find((item) => item.slug === slug && isPublishedNow(item, now));
  if (!found) {
    return (
      <main className="container py-20">
        <h1 className="heading-2">{t("events.notPublished")}</h1>
        <Link href="/events" className="btn-outline mt-6">{t("events.all")}</Link>
      </main>
    );
  }

  const event = {
    ...found,
    speakers: [
      ...(found.speakers ?? []),
      ...speakerRecords
        .filter((record) => record.eventSlug === slug)
        .map((record) => ({ id: record.id, name: record.name, designation: record.designation, topic: record.topic })),
    ],
    schedule: [
      ...(found.schedule ?? []),
      ...scheduleRecords
        .filter((record) => record.eventSlug === slug)
        .map((record) => ({ id: record.id, time: record.time, title: record.title, description: record.description })),
    ],
  };

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
          {event.bannerUrl && /^(https?:|data:image)/.test(event.bannerUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.bannerUrl} alt="" className="mt-6 aspect-[21/9] w-full max-w-5xl rounded-2xl border border-border object-cover" />
          )}
          <p className="mt-4 max-w-3xl text-body">{event.shortDescription}</p>
          <p className="mt-4 text-sm font-semibold text-burgundy">
            {eventDateText(event)}
            {eventTimeText(event) ? ` · ${eventTimeText(event)}` : ""}
            {` · ${eventPlaceText(event)}`}
          </p>
        </div>
      </section>
      <section className="section bg-background">
        <div className="container grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <p className="text-body whitespace-pre-line">{event.description}</p>
            {event.tbd?.schedule ? (
              <div>
                <h2 className="heading-3">Schedule</h2>
                <p className="mt-3 rounded-xl border border-dashed border-border bg-warm-cream p-4 text-sm text-text-muted">The programme schedule is {TBA.toLowerCase()}.</p>
              </div>
            ) : event.schedule.length > 0 && (
              <div>
                <h2 className="heading-3">Schedule</h2>
                <ul className="mt-4 space-y-3">
                  {event.schedule.map((item) => (
                    <li key={item.id} className="rounded-xl border border-border bg-white p-4">
                      <p className="text-sm font-semibold text-burgundy">{item.time}</p>
                      <p className="font-semibold">{item.title}</p>
                      {item.description && <p className="text-sm text-text-muted">{item.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {event.tbd?.speakers ? (
              <div>
                <h2 className="heading-3">Speakers</h2>
                <p className="mt-3 rounded-xl border border-dashed border-border bg-warm-cream p-4 text-sm text-text-muted">Speakers will be announced soon.</p>
              </div>
            ) : event.speakers.length > 0 && (
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
            <p className="mt-1 text-2xl font-semibold text-text-primary">{eventFeeText(event)}</p>
            <div className="mt-4">
              <RegistrationCountdown event={event} />
            </div>
            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-text-muted">Dates</dt><dd className="text-right font-medium">{eventDateText(event)}</dd></div>
              {eventTimeText(event) && <div className="flex justify-between gap-3"><dt className="text-text-muted">Time</dt><dd className="text-right font-medium">{eventTimeText(event)}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-text-muted">Where</dt><dd className="text-right font-medium">{eventPlaceText(event)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-text-muted">Mode</dt><dd className="text-right font-medium">{event.mode}</dd></div>
            </dl>
            {event.tbd?.registration || !event.registrationUrl?.trim() ? (
              <p className="mt-5 rounded-xl border border-dashed border-border bg-warm-cream px-4 py-3 text-sm text-text-muted">
                Registration link {TBA.toLowerCase()}.
              </p>
            ) : (
              <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 w-full">
                Register
              </a>
            )}
            {!event.tbd?.venue && mapsEmbedUrl(event) && (
              <iframe
                title={`${event.name} location`}
                src={mapsEmbedUrl(event)}
                className="mt-4 h-48 w-full rounded-xl border border-border"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
