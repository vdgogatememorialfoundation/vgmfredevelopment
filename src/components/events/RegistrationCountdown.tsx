"use client";

import { useEffect, useState } from "react";
import type { Event } from "@/types";
import { formatCountdown } from "@/lib/schedule";
import { isRegistrationClosed } from "@/lib/event-status";

type TimerRow = { id: string; at: number; label: string };

function parseStamp(value?: string) {
  if (!value) return NaN;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return Date.parse(`${trimmed}T00:00:00`);
  return Date.parse(trimmed);
}

function timersFor(event: Event, now: number): TimerRow[] {
  const rows: TimerRow[] = [];
  if (!event.tbd?.dates) {
    const starts = parseStamp(event.startDate);
    if (Number.isFinite(starts) && starts > now) {
      rows.push({ id: "start", at: starts, label: "Event starts in" });
    }
  }
  if (!isRegistrationClosed(event, now) && !event.tbd?.registration) {
    const opens = parseStamp(event.registrationStart);
    const closes = parseStamp(event.registrationEnd);
    if (Number.isFinite(opens) && opens > now) {
      rows.push({ id: "regopen", at: opens, label: "Registration opens in" });
    }
    if (Number.isFinite(closes) && closes > now) {
      rows.push({ id: "regclose", at: closes, label: "Registration closes in" });
    }
  }
  return rows;
}

export function RegistrationCountdown({ event, compact = false }: { event: Event; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timers = timersFor(event, now)
    .map((row) => ({ ...row, count: formatCountdown(row.at - now) }))
    .filter((row) => !row.count.expired);
  if (!timers.length) return null;

  if (compact) {
    return (
      <div className="space-y-1">
        {timers.map((row) => (
          <p key={row.id} className="text-xs font-semibold text-burgundy">
            {row.label} {row.count.label}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className={timers.length > 1 ? "grid gap-2" : undefined}>
      {timers.map((row) => (
        <div key={row.id} className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-burgundy">{row.label}</p>
          <p className="mt-1 font-serif text-lg font-semibold text-ink">{row.count.label}</p>
        </div>
      ))}
    </div>
  );
}
