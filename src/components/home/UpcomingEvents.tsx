"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import EventCard from "@/components/events/EventCard";
import { useLiveEvents } from "@/lib/use-cms";
import { compareEventDates } from "@/lib/event-display";

export default function UpcomingEvents() {
  const events = useLiveEvents();
  const upcoming = events
    .filter((event) => event.registrationStatus !== "Closed")
    .sort(compareEventDates)
    .slice(0, 3);

  return (
    <section className="section-paper" aria-labelledby="upcoming-events-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Events"
          title="Events & programmes"
          description="Upcoming programmes from the Foundation."
          action={
            <Link href="/events" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
              View all
            </Link>
          }
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        <div className="mt-8">
          <Link href="/events" className="btn-primary">
            View all events
          </Link>
        </div>
      </div>
    </section>
  );
}