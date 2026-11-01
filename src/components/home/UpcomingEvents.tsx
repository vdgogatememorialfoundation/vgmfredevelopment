"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import EventCard from "@/components/events/EventCard";
import { useLiveEvents } from "@/lib/use-cms";
import { compareEventDates } from "@/lib/event-display";
import { isEventPast } from "@/lib/event-status";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { isPublishedNow } from "@/lib/schedule";
import { useScheduleTick } from "@/lib/use-schedule";

export default function UpcomingEvents() {
  const now = useScheduleTick();
  const events = useLiveEvents().filter((event) => isPublishedNow(event, now));
  const { t } = useI18n();
  const upcoming = events
    .filter((event) => !isEventPast(event, now))
    .sort(compareEventDates)
    .slice(0, 3);
  const past = events
    .filter((event) => isEventPast(event, now))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <section className="section-paper" aria-labelledby="upcoming-events-heading">
      <div className="container">
        <SectionHeading
          eyebrow={t("home.eventsEyebrow")}
          title={t("home.eventsTitle")}
          description={t("home.eventsDesc")}
          action={
            <Link href="/events" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
              {t("common.viewAll")}
            </Link>
          }
        />

        {upcoming.length === 0 && past.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-primary">
            {t("home.noEvents")}
          </p>
        ) : null}

        {upcoming.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : null}

        {past.length > 0 ? (
          <div className={upcoming.length > 0 ? "mt-10" : ""}>
            <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("home.pastEvents")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {past.map((event) => (
                <EventCard key={event.id} event={event} variant="compact" />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <Link href="/events" className="btn-primary">
            {t("home.viewEvents")}
          </Link>
        </div>
      </div>
    </section>
  );
}