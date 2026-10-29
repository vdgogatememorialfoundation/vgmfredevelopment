"use client";

import { useEffect, useState } from "react";
import type { Event } from "@/types";
import { formatCountdown } from "@/lib/schedule";

function targetFor(event: Event, now: number) {
  if (event.registrationStatus === "Closed" || event.tbd?.registration) return null;
  const opens = event.registrationStart ? Date.parse(event.registrationStart) : NaN;
  const closes = event.registrationEnd ? Date.parse(event.registrationEnd) : NaN;
  if (Number.isFinite(opens) && opens > now) {
    return { at: opens, label: "Registration opens in" };
  }
  if (Number.isFinite(closes) && closes > now) {
    return { at: closes, label: "Registration closes in" };
  }
  return null;
}

export function RegistrationCountdown({ event, compact = false }: { event: Event; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const target = targetFor(event, now);
  if (!target) return null;
  const count = formatCountdown(target.at - now);
  if (count.expired) return null;

  if (compact) {
    return (
      <p className="text-xs font-semibold text-burgundy">
        {target.label} {count.label}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-burgundy">{target.label}</p>
      <p className="mt-1 font-serif text-lg font-semibold text-ink">{count.label}</p>
    </div>
  );
}
