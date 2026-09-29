import Link from "next/link";
import type { Event } from "@/types";
import Badge from "@/components/common/Badge";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { formatDateRange } from "@/lib/utils";

const statusTone: Record<string, "burgundy" | "success" | "warning" | "neutral"> = {
  Open: "success",
  "Closing Soon": "warning",
  Closed: "neutral",
  Waitlist: "warning",
};

export default function EventCard({ event }: { event: Event }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="relative">
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
          className="text-sm font-semibold text-burgundy"
        >
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

        <div className="mt-4 flex items-center gap-2 text-sm text-text-muted">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span className="line-clamp-1">
            {event.mode === "Online" ? "Online" : event.venue}
          </span>
        </div>

        <Link
          href={`/events/${event.slug}`}
          className="btn-primary mt-6 w-full"
        >
          View Event
        </Link>

        <Link
          href="https://seminar.vaidyagogate.org"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline mt-3 w-full"
        >
          Register on Seminar Website
        </Link>
      </div>
    </article>
  );
}