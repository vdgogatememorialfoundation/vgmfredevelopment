import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import EventCard from "@/components/events/EventCard";
import Reveal from "@/components/common/Reveal";
import { events as defaultEvents } from "@/data/events";

export default function UpcomingEvents({ events = defaultEvents }: { events?: typeof defaultEvents }) {
  const upcoming = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 6);

  return (
    <section className="section bg-white" aria-labelledby="upcoming-events-heading">
      <div className="container">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            id="upcoming-events-heading"
            align="left"
            eyebrow="Calendar"
            title="Upcoming events & programmes"
            description="Seminars, workshops, fellowships and public programmes from the Foundation."
          />
          <Link href="/events" className="btn-outline mb-12 shrink-0">
            View full calendar
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event, index) => (
            <Reveal key={event.id} delay={(index % 3) * 100}>
              <EventCard event={event} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
