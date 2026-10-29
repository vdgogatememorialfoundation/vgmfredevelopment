"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import EventCard from "@/components/events/EventCard";
import { useLiveEvents } from "@/lib/use-cms";
import { compareEventDates } from "@/lib/event-display";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function UpcomingEvents() {
  const events = useLiveEvents();
  const { t } = useI18n();
  const upcoming = events
    .filter((event) => event.registrationStatus !== "Closed")
    .sort(compareEventDates)
    .slice(0, 3);

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

        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">
            {t("home.noEvents")}
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link href="/events" className="btn-primary">
            {t("home.viewEvents")}
          </Link>
        </div>
      </div>
    </section>
  );
}