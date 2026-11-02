"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Event, ScheduleItem, Speaker } from "@/types";
import { applyPartnerFeed } from "@/lib/partner-hydrate";
import { partnerPortalLabel } from "@/lib/partner-labels";

type Row = Pick<Event, "id" | "name" | "slug" | "source" | "venue" | "schedule" | "speakers">;

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

function usePortalEvents() {
  const [events, setEvents] = useState<Row[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/partners/schedules", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { events?: Event[] }) => {
        if (cancelled || !data.events?.length) return;
        applyPartnerFeed({ events: data.events });
        setEvents(data.events.filter((event) => event.source === "seminar" || event.source === "autism"));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return events;
}

function EventSelect({ events, value, onChange, label }: { events: Row[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-burgundy">{label}</span>
      <select className="input-field" value={value} onChange={(event) => onChange(event.target.value)}>
        {events.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function EventSchedules({ variant = "page" }: { variant?: "page" | "home" }) {
  const events = usePortalEvents().filter((event) => sessions(event).length > 0);
  const [eventId, setEventId] = useState("");
  const selected = events.find((event) => event.id === eventId) ?? events[0];
  const listed = useMemo(() => {
    const rows = selected ? sessions(selected) : [];
    return variant === "home" ? rows.slice(0, 4) : rows;
  }, [selected, variant]);

  useEffect(() => {
    if (!eventId && events[0]) setEventId(events[0].id);
  }, [eventId, events]);

  if (!events.length) return null;

  return (
    <section className={variant === "page" ? "section bg-white" : "mt-10"} aria-labelledby="event-schedules-heading">
      <div className={variant === "page" ? "container" : ""}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-burgundy">Programmes</p>
            <h2 id="event-schedules-heading" className="heading-3 mt-1">Event schedules</h2>
          </div>
          {variant === "home" && (
            <Link href="/schedules" className="text-sm font-semibold text-burgundy">
              Full schedule
            </Link>
          )}
        </div>
        <EventSelect events={events} value={selected?.id ?? ""} onChange={setEventId} label="Event name" />
        {selected && (
          <article className="mt-6 rounded-2xl border border-border bg-warm-cream/40 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-text-primary">
                <Link href={`/events/${selected.slug}`} className="hover:text-burgundy">{selected.name}</Link>
              </h3>
              {(selected.source === "seminar" || selected.source === "autism") && (
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink">{partnerPortalLabel(selected.source)}</span>
              )}
            </div>
            {selected.venue && <p className="mt-1 text-sm text-text-muted">{selected.venue}</p>}
            <ol className="mt-4 space-y-3">
              {listed.map((item: ScheduleItem) => (
                <li key={item.id} className="rounded-xl border border-border bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-burgundy">Starts {whenLabel(item.time)}</p>
                  {item.endTime ? <p className="text-xs font-semibold text-ink">Ends {whenLabel(item.endTime)}</p> : null}
                  <p className="mt-1 font-semibold text-text-primary">{item.title}</p>
                </li>
              ))}
            </ol>
          </article>
        )}
      </div>
    </section>
  );
}

type SpeakerCard = Speaker & { topics: string[] };

function speakersFor(event: Row): SpeakerCard[] {
  const map = new Map<string, SpeakerCard>();
  for (const speaker of event.speakers ?? []) {
    const name = speaker.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...speaker, name, topics: speaker.topic ? [speaker.topic] : [] });
      continue;
    }
    if (speaker.topic && !current.topics.includes(speaker.topic)) current.topics.push(speaker.topic);
    if (!current.bio && speaker.bio) current.bio = speaker.bio;
  }
  return [...map.values()];
}

export function SpeakerBoard({ variant = "page" }: { variant?: "page" | "home" }) {
  const events = usePortalEvents().filter((event) => speakersFor(event).length > 0);
  const [eventId, setEventId] = useState("");
  const selected = events.find((event) => event.id === eventId) ?? events[0];
  const people = selected ? speakersFor(selected) : [];
  const shown = variant === "home" ? people.slice(0, 4) : people;

  useEffect(() => {
    if (!eventId && events[0]) setEventId(events[0].id);
  }, [eventId, events]);

  if (!events.length) return null;

  return (
    <section className="section bg-white" aria-labelledby="event-speakers-heading">
      <div className="container">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-burgundy">Faculty</p>
            <h2 id="event-speakers-heading" className="heading-3 mt-1">Speakers</h2>
          </div>
          {variant === "home" && (
            <Link href="/speakers" className="text-sm font-semibold text-burgundy">
              All speakers
            </Link>
          )}
        </div>
        <EventSelect events={events} value={selected?.id ?? ""} onChange={setEventId} label="Event name" />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {shown.map((speaker) => (
            <li key={speaker.id} className="rounded-2xl border border-border bg-white p-4">
              <p className="font-semibold text-text-primary">{speaker.name}</p>
              {speaker.topics.length > 0 && <p className="mt-1 text-sm text-text-muted">{speaker.topics.join(" · ")}</p>}
              {speaker.bio && <p className="mt-2 text-sm text-text-primary">{speaker.bio}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
