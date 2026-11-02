"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Event, ScheduleItem } from "@/types";
import { applyPartnerFeed } from "@/lib/partner-hydrate";
import { partnerPortalLabel } from "@/lib/partner-labels";

type Row = Pick<Event, "id" | "name" | "slug" | "source" | "venue" | "schedule">;

function whenLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return `${date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} IST`;
}

function sessions(event: Row) {
  return (event.schedule ?? []).filter((item) => item.title || item.time);
}

export default function EventSchedules({ compact = false }: { compact?: boolean }) {
  const [events, setEvents] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/partners/schedules", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { events?: Event[] }) => {
        if (cancelled || !data.events?.length) return;
        applyPartnerFeed({ events: data.events });
        setEvents(
          data.events
            .filter((event) => event.source === "seminar" || event.source === "autism")
            .filter((event) => sessions(event).length > 0)
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const listed = compact ? events.slice(0, 2) : events;
  if (!listed.length) return null;

  const body = (
    <>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-burgundy">Programmes</p>
            <h2 id="event-schedules-heading" className="heading-3 mt-1">Event schedules</h2>
          </div>
          {compact && (
            <Link href="/events#schedules" className="text-sm font-semibold text-burgundy">
              All schedules
            </Link>
          )}
        </div>
        <div id={compact ? undefined : "schedules"} className="space-y-6">
          {listed.map((event) => (
            <article key={event.id} className="rounded-2xl border border-border bg-warm-cream/40 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-text-primary">
                  <Link href={`/events/${event.slug}`} className="hover:text-burgundy">{event.name}</Link>
                </h3>
                {(event.source === "seminar" || event.source === "autism") && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink">{partnerPortalLabel(event.source)}</span>}
              </div>
              {event.venue && <p className="mt-1 text-sm text-text-muted">{event.venue}</p>}
              <ol className="mt-4 space-y-3">
                {sessions(event).map((item: ScheduleItem) => (
                  <li key={item.id} className="rounded-xl border border-border bg-white px-4 py-3">
                    <p className="text-xs font-semibold text-burgundy">{whenLabel(item.time)}</p>
                    <p className="mt-1 font-semibold text-text-primary">{item.title}</p>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
    </>
  );

  if (compact) {
    return (
      <div className="mt-10" role="region" aria-labelledby="event-schedules-heading">
        {body}
      </div>
    );
  }

  return (
    <section className="section bg-white" aria-labelledby="event-schedules-heading">
      <div className="container">{body}</div>
    </section>
  );
}
