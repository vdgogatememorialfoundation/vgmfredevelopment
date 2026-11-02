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
import { useCommerceMirror } from "@/lib/commerce-sync";
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

type MapVisitor = { city: string; country: string; lat?: number; lng?: number; path: string; title?: string };

function LiveMap({ visitors, apiKey }: { visitors: MapVisitor[]; apiKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    const existing = document.getElementById("vgmf-maps-js");
    if (existing) {
      if ((window as unknown as { google?: { maps?: unknown } }).google?.maps) setReady(true);
      else existing.addEventListener("load", () => setReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "vgmf-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    const maps = (window as unknown as { google?: { maps?: { Map: new (el: HTMLElement, opts: object) => { fitBounds: (bounds: object) => void }; Marker: new (opts: object) => unknown; LatLngBounds: new () => { extend: (point: object) => void } } } }).google?.maps;
    if (!apiKey || !ready || !ref.current || !maps) return;
    const pins = visitors.filter((visitor) => typeof visitor.lat === "number" && typeof visitor.lng === "number");
    const map = new maps.Map(ref.current, {
      zoom: pins.length ? 5 : 2,
      center: pins[0] ? { lat: pins[0].lat as number, lng: pins[0].lng as number } : { lat: 20, lng: 78 },
      mapTypeControl: false,
      streetViewControl: false,
    });
    const bounds = new maps.LatLngBounds();
    for (const visitor of pins) {
      const position = { lat: visitor.lat as number, lng: visitor.lng as number };
      bounds.extend(position);
      new maps.Marker({
        map,
        position,
        title: `${visitor.city || visitor.country} · ${visitor.title || visitor.path}`,
      });
    }
    if (pins.length > 1) map.fitBounds(bounds);
  }, [visitors, apiKey, ready]);

  if (!apiKey) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        Add a Google Maps JavaScript API key under Settings to see live visitor pins on the map.
      </p>
    );
  }

  return <div ref={ref} className="mt-4 h-80 w-full overflow-hidden rounded-xl border border-slate-200" />;
}

type LiveRow = MapVisitor & {
  sessionId: string;
  region: string;
  audience: "visitor" | "customer";
  label: string;
  lastSeen: string;
};

type PageRow = {
  id: string;
  path: string;
  title: string;
  city: string;
  country: string;
  audience: "visitor" | "customer";
  label: string;
  at: string;
};

type ActionRow = { id: string; at: string; email: string; kind: string; detail: string };

function ActivityTable({ rows, empty }: { rows: { id: string; at: string; who: string; where: string; what: string }[]; empty: string }) {
  const ordered = [...rows].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!ordered.length) return <p className="mt-3 text-sm text-slate-500">{empty}</p>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-4">When</th>
            <th className="py-2 pr-4">Who</th>
            <th className="py-2 pr-4">Where</th>
            <th className="py-2">What</th>
          </tr>
        </thead>
        <tbody>
          {ordered.slice(0, 80).map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="py-2 pr-4 text-slate-500">{when(row.at)}</td>
              <td className="py-2 pr-4">{row.who}</td>
              <td className="py-2 pr-4">{row.where}</td>
              <td className="py-2 font-medium">{row.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function when(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + " IST";
}

export function AnalyticsDesk({ focus = "overview" }: { focus?: "overview" | "users" | "customers" }) {
  useSyncExternalStore(subscribeAnalytics, snapshot, () => "");
  const { version } = useCommerceMirror();
  const hits = getHits();
  const live = getLiveVisitors();
  const day = hitsSince(24);
  const week = hitsSince(24 * 7);
  const settings = getSettings();
  const orders = getOrders();
  void version;
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

  const [remoteLive, setRemoteLive] = useState<LiveRow[] | null>(null);
  const [userActivity, setUserActivity] = useState<PageRow[]>([]);
  const [customerActivity, setCustomerActivity] = useState<ActionRow[]>([]);
  const [customerBrowsing, setCustomerBrowsing] = useState<PageRow[]>([]);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      const response = await fetch("/api/analytics/live", { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json().catch(() => null)) as {
        live?: LiveRow[];
        userActivity?: PageRow[];
        customerActivity?: ActionRow[];
        customerBrowsing?: PageRow[];
      } | null;
      if (stop || !response.ok || !data) return;
      setRemoteLive(data.live ?? []);
      setUserActivity(data.userActivity ?? []);
      setCustomerActivity(data.customerActivity ?? []);
      setCustomerBrowsing(data.customerBrowsing ?? []);
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);
  const shownLive: LiveRow[] = remoteLive ?? live.map((visitor) => ({
    ...visitor,
    audience: "visitor",
    label: "",
    title: visitor.title,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{focus === "users" ? "User activity" : focus === "customers" ? "Customer activity" : "Analytics"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          The map and the lists refresh every 10 seconds. A pin uses the city from the connection, and the page is the one open in that browser.
        </p>
      </div>

      {focus === "overview" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Visits (24h)" value={day.length} hint={`${uniqueSessions(day)} sessions`} />
        <Stat label="Visits (7 days)" value={week.length} hint={`${uniqueSessions(week)} sessions`} />
        <Stat label="All recorded visits" value={hits.length} hint={`${uniqueSessions(hits)} sessions`} />
        <Stat label="Live now" value={shownLive.length} hint="active in the last 5 minutes" />
      </div>}

      {focus === "overview" && <article className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Live visitors</h2>
        <p className="mt-1 text-sm text-slate-500">Pins show the city from the visitor’s connection, and the table shows the page open in that browser.</p>
        <LiveMap visitors={shownLive} apiKey={settings.apiKeys.googleMaps} />
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Who</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Page</th>
                <th className="py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {shownLive.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No live visitors yet. Open the public site in another browser to see a pin and the page.
                  </td>
                </tr>
              ) : (
                shownLive.map((visitor) => (
                  <tr key={visitor.sessionId} className="border-t border-slate-100">
                    <td className="py-2 pr-4">{visitor.audience === "customer" ? visitor.label || "Customer" : "Visitor"}</td>
                    <td className="py-2 pr-4">
                      {[visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ")}
                    </td>
                    <td className="py-2 pr-4 font-medium">{visitor.title ? `${visitor.title} · ${visitor.path}` : visitor.path}</td>
                    <td className="py-2 text-slate-500">{when(visitor.lastSeen)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>}

      {(focus === "overview" || focus === "users") && (
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">User activity</h2>
          <p className="mt-1 text-sm text-slate-500">Pages opened on the public site in the last 24 hours.</p>
          <ActivityTable
            rows={userActivity.map((row) => ({
              id: row.id,
              at: row.at,
              who: row.audience === "customer" ? row.label || "Customer" : "Visitor",
              where: [row.city, row.country].filter(Boolean).join(", "),
              what: `${row.title || row.path} · ${row.path}`,
            }))}
            empty="No page views yet."
          />
        </article>
      )}

      {(focus === "overview" || focus === "customers") && (
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Customer activity</h2>
          <p className="mt-1 text-sm text-slate-500">Signed-in customers: account actions and the pages they opened.</p>
          <ActivityTable
            rows={[
              ...customerActivity.map((row) => ({
                id: row.id,
                at: row.at,
                who: row.email,
                where: row.kind,
                what: row.detail || row.kind,
              })),
              ...customerBrowsing.map((row) => ({
                id: row.id,
                at: row.at,
                who: row.label || "Customer",
                where: [row.city, row.country].filter(Boolean).join(", "),
                what: `Viewed ${row.path}`,
              })),
            ]}
            empty="No customer activity yet."
          />
        </article>
      )}

      {focus === "overview" && <div className="grid gap-4 lg:grid-cols-2">
        <RankTable title="By country" rows={countBy(hits, "country")} />
        <RankTable title="By state / region" rows={countBy(hits, "region")} />
        <RankTable title="By city" rows={countBy(hits, "city")} />
        <RankTable title="Most visited pages" rows={countBy(hits, "path")} />
        <RankTable title="Most visited articles" rows={blogRows} />
        <RankTable title="Most ordered products" rows={productCounts} />
      </div>}

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
