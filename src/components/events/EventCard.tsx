import Link from "next/link";
import type { Event } from "@/types";
import Badge from "@/components/common/Badge";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { ArrowRight, CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { formatDateRange } from "@/lib/utils";

const statusTone: Record<string, "burgundy" | "success" | "warning" | "neutral"> = {
  Open: "success",
  "Closing Soon": "warning",
  Closed: "neutral",
  Waitlist: "warning",
};

export default function EventCard({ event }: { event: Event }) {
  return (
    <article className="card group flex h-full flex-col overflow-hidden">
      <div className="relative overflow-hidden [&>div:first-child]:transition [&>div:first-child]:duration-700 group-hover:[&>div:first-child]:scale-105">
        <MediaPlaceholder
          variant="event"
          label={event.name}
          src={event.bannerUrl}
          aspectClassName="aspect-[16/9]"
        />
        <div className="absolute top-4 left-4">
          <Badge tone="burgundy">{event.eventType}</Badge>
        </div>
        <div className="absolute top-4 right-4">
          <Badge tone={statusTone[event.registrationStatus] ?? "neutral"}>
            {event.registrationStatus}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <time
          dateTime={event.startDate}
          className="flex items-center gap-2 text-sm font-semibold text-burgundy"
        >
          <CalendarDays size={15} />
          {formatDateRange(event.startDate, event.endDate)}
        </time>

        <h3 className="mt-2 text-lg font-semibold text-text-primary leading-snug">
          <Link
            href={`/events/${event.slug}`}
            className="transition hover:text-burgundy"
          >
            {event.name}
          </Link>
        </h3>

        <p className="mt-2 text-sm text-text-muted line-clamp-2">
          {event.shortDescription}
        </p>

        <div className="mb-6 mt-4 flex items-center gap-2 text-sm text-text-muted">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-cream text-burgundy">
            <MapPin size={14} />
          </span>
          <span className="line-clamp-1">
            {event.mode === "Online" ? "Online" : event.venue}
          </span>
        </div>

        <Link
          href={`/events/${event.slug}`}
          className="btn-primary mt-auto w-full"
        >
          View Event
          <ArrowRight size={16} />
        </Link>

        <Link
          href="https://seminar.vaidyagogate.org"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline mt-3 w-full"
        >
          Register on Seminar Website
          <ExternalLink size={14} />
        </Link>
      </div>
    </article>
  );
}