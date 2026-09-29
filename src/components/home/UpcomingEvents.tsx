import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import EventCard from "@/components/events/EventCard";
import { events } from "@/data/events";

export default function UpcomingEvents() {
  const upcoming = [...events].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  return (
    <section
      className="section bg-background"
      aria-labelledby="upcoming-events-heading"
    >
      <div className="container">
        <SectionHeading
          eyebrow="Upcoming Events"
          title="Events & Programmes"
          description="Seminars, workshops, fellowships and public programmes from the Foundation."
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