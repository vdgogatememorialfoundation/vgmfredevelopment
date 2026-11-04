"use client";

import { useEffect, useState } from "react";
import { seminarSiteUrl } from "@/lib/constants";

type LiveSeminar = {
  id: number;
  title: string;
  event_date: string | null;
  live: boolean;
  status: string;
  embed_url: string;
  register_url: string;
};

const LIVE_API = `${seminarSiteUrl}/api/public/online-seminar/live`;

/** Online seminars streamed from the registration portal. Only registered doctors can watch; the sign-in happens inside the player. */
export function LiveSeminarBlock() {
  const [items, setItems] = useState<LiveSeminar[]>([]);

  useEffect(() => {
    let stopped = false;
    const load = () =>
      fetch(LIVE_API, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!stopped) setItems(Array.isArray(data?.seminars) ? data.seminars : []);
        })
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="section border-b border-border bg-warm-cream" id="live-seminar">
      <div className="container space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="heading-3">{items.some((item) => item.live) ? "Live now: online seminar" : "Online seminar"}</h2>
          <p className="text-sm text-muted-foreground">Registered doctors sign in with their registered email inside the player.</p>
        </div>
        <div className="grid gap-6">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.event_date && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
                <span
                  className={
                    "rounded-full px-3 py-1 text-xs font-bold " +
                    (item.live ? "bg-red-100 text-red-700" : "bg-border text-foreground")
                  }
                >
                  {item.live ? "LIVE" : "Scheduled"}
                </span>
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={item.embed_url}
                  title={item.title}
                  allow="autoplay; fullscreen; encrypted-media"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
              <p className="px-5 py-3 text-xs text-muted-foreground">
                Not registered?{" "}
                <a className="font-semibold underline" href={item.register_url} target="_blank" rel="noopener noreferrer">
                  Register on the doctor portal
                </a>
                .
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
