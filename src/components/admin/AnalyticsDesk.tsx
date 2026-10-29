"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getSettings } from "@/lib/admin-store";
import {
  articleHits,
  countBy,
  getHits,
  getLiveVisitors,
  hitsSince,
  subscribeAnalytics,
  uniqueSessions,
} from "@/lib/analytics";
import { getLiveArticles } from "@/lib/cms";
import { getOrders } from "@/lib/store";

function snapshot() {
  return `${window.localStorage.getItem("vgmf_analytics_hits") ?? ""}|${window.localStorage.getItem("vgmf_analytics_live") ?? ""}`;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function RankTable({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No visits recorded yet. Open the public site to start collecting.</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {rows.slice(0, 12).map(([label, count]) => (
            <li key={label} className="flex justify-between gap-3">
              <span className="truncate text-slate-700">{label}</span>
              <span className="font-semibold text-slate-900">{count}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function LiveMap({ visitors, apiKey }: { visitors: { city: string; country: string; lat?: number; lng?: number; path: string }[]; apiKey: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const maps = (window as unknown as { google?: { maps?: { Map: new (el: HTMLElement, opts: object) => unknown; Marker: new (opts: object) => unknown } } }).google?.maps;
    if (!apiKey || !ref.current || !maps) return;
    const map = new maps.Map(ref.current, {
      zoom: 2,
      center: { lat: 20, lng: 78 },
      mapTypeControl: false,
      streetViewControl: false,
    });
    for (const visitor of visitors) {
      if (typeof visitor.lat !== "number" || typeof visitor.lng !== "number") continue;
      new maps.Marker({
        map,
        position: { lat: visitor.lat, lng: visitor.lng },
        title: `${visitor.city || visitor.country} · ${visitor.path}`,
      });
    }
  }, [visitors, apiKey]);

  useEffect(() => {
    if (!apiKey || document.getElementById("vgmf-maps-js")) return;
    const script = document.createElement("script");
    script.id = "vgmf-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    document.head.appendChild(script);
  }, [apiKey]);

  if (!apiKey) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        Add a Google Maps JavaScript API key under Settings to see live visitor pins on the map.
      </p>
    );
  }

  return <div ref={ref} className="mt-4 h-80 w-full overflow-hidden rounded-xl border border-slate-200" />;
}

export function AnalyticsDesk() {
  useSyncExternalStore(subscribeAnalytics, snapshot, () => "");
  const hits = getHits();
  const live = getLiveVisitors();
  const day = hitsSince(24);
  const week = hitsSince(24 * 7);
  const settings = getSettings();
  const orders = getOrders();
  const articles = getLiveArticles();

  const productCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        map.set(item.title, (map.get(item.title) || 0) + item.quantity);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);

  const blogRows = useMemo(() => {
    const byPath = countBy(articleHits(hits), "path");
    return byPath.map(([path, count]) => {
      const slug = path.replace("/articles/", "").replace("/articles", "");
      const article = articles.find((item) => item.slug === slug);
      return [article?.title || path, count] as [string, number];
    });
  }, [hits, articles]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          First-party visitor counts, live activity, and Google Analytics. Refresh {tick === 0 ? "is live" : "every 15 seconds"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Visits (24h)" value={day.length} hint={`${uniqueSessions(day)} sessions`} />
        <Stat label="Visits (7 days)" value={week.length} hint={`${uniqueSessions(week)} sessions`} />
        <Stat label="All recorded visits" value={hits.length} hint={`${uniqueSessions(hits)} sessions`} />
        <Stat label="Live now" value={live.length} hint="active in the last 5 minutes" />
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Live visitors</h2>
        <p className="mt-1 text-sm text-slate-500">Where people are browsing right now, and which page they are on.</p>
        <LiveMap visitors={live} apiKey={settings.apiKeys.googleMaps} />
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Page</th>
                <th className="py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {live.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-slate-500">
                    No live visitors yet.
                  </td>
                </tr>
              ) : (
                live.map((visitor) => (
                  <tr key={visitor.sessionId} className="border-t border-slate-100">
                    <td className="py-2 pr-4">
                      {[visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ")}
                    </td>
                    <td className="py-2 pr-4 font-medium">{visitor.path}</td>
                    <td className="py-2 text-slate-500">{new Date(visitor.lastSeen).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankTable title="By country" rows={countBy(hits, "country")} />
        <RankTable title="By state / region" rows={countBy(hits, "region")} />
        <RankTable title="By city" rows={countBy(hits, "city")} />
        <RankTable title="Most visited pages" rows={countBy(hits, "path")} />
        <RankTable title="Most visited articles" rows={blogRows} />
        <RankTable title="Most ordered products" rows={productCounts} />
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Google Analytics</h2>
        {settings.apiKeys.googleAnalytics ? (
          <p className="mt-2 text-sm text-slate-600">
            Measurement ID <span className="font-semibold">{settings.apiKeys.googleAnalytics}</span> is injected on the public site.
            Open the{" "}
            <a className="font-semibold text-burgundy" href="https://analytics.google.com/" target="_blank" rel="noreferrer">
              Google Analytics dashboard
            </a>{" "}
            for real-time and acquisition reports.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Paste a GA4 measurement ID (G-…) under Settings → General to send public-site page views to Google Analytics.
          </p>
        )}
      </article>
    </div>
  );
}
