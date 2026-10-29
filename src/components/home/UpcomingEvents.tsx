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
    <section
      className="section bg-background py-10"
      aria-labelledby="upcoming-events-heading"
    >
      <div className="container">
        <SectionHeading
          eyebrow="Upcoming Events"
          title="Events & Programmes"
          description="Upcoming programmes from the Foundation."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/events" className="btn-primary">
            View All Events
          </Link>
        </div>
      </div>
    </section>
  );
}