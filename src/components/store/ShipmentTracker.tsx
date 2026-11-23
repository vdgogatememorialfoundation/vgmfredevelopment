"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PipelineStageShape } from "@/components/tracking/VerticalPipeline";
import { statusStamp } from "@/lib/delivery-expectation";

type Shipment = {
  orderId: string;
  courier: string;
  awb: string;
  status: string;
  expectedBy: string;
  destination: string;
  lastEvent: { at: string; status: string; location: string } | null;
  stages: PipelineStageShape[];
};
type Result = { ok?: boolean; error?: string; ownFleet?: boolean; shipments?: Shipment[]; checkedAt?: string };

const tone = (status: string) =>
  status === "Delivered" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : /cancel|fail|return/i.test(status) ? "bg-red-50 text-red-700 ring-red-200" : "bg-sky-50 text-sky-700 ring-sky-200";

function progress(stages: PipelineStageShape[]) {
  if (!stages.length) return 0;
  const reached = stages.filter((s) => s.reached).length;
  const partial = stages.some((s) => s.partial && !s.reached) ? 0.5 : 0;
  return Math.min(100, Math.round(((reached - 1 + partial) / Math.max(1, stages.length - 1)) * 100));
}

function untilText(expected: string) {
  const t = Date.parse(expected);
  if (!Number.isFinite(t)) return "";
  const days = Math.ceil((t - Date.now()) / 86_400_000);
  if (days < 0) return "Running late — the courier is updating the date";
  if (days === 0) return "Arriving today";
  if (days === 1) return "Arriving tomorrow";
  return `Arriving in ${days} days`;
}

/** Horizontal green tracker: the line fills slowly up to the current step; each main status lists its own updates underneath. */
function HorizontalTrack({ stages, expectedBy, live }: { stages: PipelineStageShape[]; expectedBy: string; live: boolean }) {
  const target = progress(stages);
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setFill(target), 150);
    return () => clearTimeout(timer);
  }, [target]);
  const n = Math.max(1, stages.length);
  const current = stages.map((s) => s.reached).lastIndexOf(true);
  const inset = `${50 / n}%`;
  return (
    <div className="overflow-x-auto pb-2">
      <style>{`@keyframes vgmf-flow{from{background-position:0 0}to{background-position:28px 0}}`}</style>
      <div className="relative px-1" style={{ minWidth: `${n * 170}px` }}>
        <div className="absolute top-[22px] h-2 rounded-full bg-slate-200" style={{ left: inset, right: inset }} />
        <div className="absolute top-[22px] h-2" style={{ left: inset, right: inset }}>
          <div
            className="relative h-full rounded-full transition-[width] ease-out"
            style={{
              width: `${fill}%`,
              transitionDuration: "3500ms",
              backgroundImage: "repeating-linear-gradient(45deg,#059669 0 8px,#10b981 8px 14px)",
              backgroundSize: "28px 100%",
              animation: live ? "vgmf-flow 1.2s linear infinite" : undefined,
            }}
          >
            {live && fill > 0 && fill < 100 ? (
              <span className="absolute -right-3.5 -top-[10px] flex h-7 w-7 items-center justify-center rounded-full bg-white text-emerald-600 shadow-md ring-2 ring-emerald-500">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7zM6.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" /></svg>
              </span>
            ) : null}
          </div>
        </div>
        <ol className="relative grid items-start" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {stages.map((stage, i) => {
            const done = stage.reached;
            const isCurrent = i === current && live;
            const last = i === n - 1;
            const events = stage.events.filter((event) => event.reached || event.at);
            return (
              <li key={stage.id} className="flex flex-col items-center px-1.5">
                <span
                  className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-[3px] text-sm font-bold shadow-sm transition-colors duration-700 ${
                    done ? "border-emerald-500 bg-emerald-500 text-white" : stage.partial ? "border-emerald-400 bg-white text-emerald-600" : "border-slate-200 bg-white text-slate-400"
                  }`}
                  style={{ transitionDelay: `${i * 450}ms` }}
                >
                  {isCurrent ? <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" /> : null}
                  {done ? <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5 9-10" /></svg> : i + 1}
                </span>
                <span className={`mt-3 text-center text-[13px] font-bold leading-tight ${done ? "text-slate-900" : "text-slate-400"}`}>{stage.label}</span>
                {stage.caption ? <span className="mt-0.5 text-center text-[11px] leading-tight text-slate-500">{stage.caption}</span> : null}
                {isCurrent ? <span className="mt-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">Current status</span> : null}
                <div className="mt-3 w-full space-y-2">
                  {events.length ? (
                    [...events].reverse().map((event) => (
                      <div key={event.id} className={`rounded-xl border p-2.5 text-left ${done ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-slate-50"}`}>
                        <p className="text-[12px] font-semibold leading-snug text-slate-800">{event.title}</p>
                        {event.location ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{event.location}</p> : null}
                        {event.at ? <p className="mt-0.5 text-[10.5px] font-medium text-emerald-700">{statusStamp(event.at)}</p> : null}
                      </div>
                    ))
                  ) : last && expectedBy ? (
                    <div className="rounded-xl border border-emerald-200 bg-white p-2.5 text-center">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Expected delivery</p>
                      <p className="mt-0.5 text-[13px] font-bold text-emerald-700">{expectedBy}</p>
                    </div>
                  ) : (
                    <p className="text-center text-[11px] text-slate-400">{done ? "" : "Waiting for this step"}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function ShipmentCard({ shipment, index, total }: { shipment: Shipment; index: number; total: number }) {
  const [copied, setCopied] = useState(false);
  const live = !["Delivered", "Cancelled", "Returned"].includes(shipment.status);
  const pct = progress(shipment.stages);
  const scans = shipment.stages.reduce((sum, stage) => sum + stage.events.filter((event) => event.at).length, 0);
  const share = async () => {
    const url = `${window.location.origin}/track?q=${encodeURIComponent(shipment.awb)}`;
    try {
      if (navigator.share) await navigator.share({ title: `Shipment ${shipment.awb}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* cancelled */
    }
  };
  const tiles: [string, string, string?][] = [
    ["Courier partner", shipment.courier],
    ["Destination", shipment.destination || "—"],
    ["Expected delivery", shipment.status === "Delivered" ? "Delivered" : shipment.expectedBy || "Updating soon", shipment.status === "Delivered" ? "" : untilText(shipment.expectedBy)],
    ["Latest update", shipment.lastEvent ? shipment.lastEvent.status : "—", shipment.lastEvent ? `${shipment.lastEvent.location ? `${shipment.lastEvent.location} · ` : ""}${statusStamp(shipment.lastEvent.at)}` : ""],
  ];
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-white px-5 py-4 sm:px-7">
        <div className="min-w-0">
          {total > 1 ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-burgundy">Shipment {index + 1} of {total}</p> : null}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tracking number (AWB)</p>
          <p className="font-mono text-2xl font-bold tracking-wide text-slate-900">{shipment.awb}</p>
          <p className="text-xs text-slate-500">Order {shipment.orderId} · {scans} scan{scans === 1 ? "" : "s"} recorded</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 ${tone(shipment.status)}`}>
            {live ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
              </span>
            ) : null}
            {shipment.status}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">{pct}% complete</span>
            <button onClick={share} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-500 hover:text-emerald-700">
              {copied ? "Link copied" : "Share tracking"}
            </button>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="bg-white px-5 py-3.5">
            <dt className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
            {sub ? <dd className="mt-0.5 text-[11px] text-emerald-700">{sub}</dd> : null}
          </div>
        ))}
      </dl>
      <div className="px-3 py-6 sm:px-6">
        <HorizontalTrack stages={shipment.stages} expectedBy={shipment.status === "Delivered" ? "" : shipment.expectedBy} live={live} />
      </div>
    </article>
  );
}

export default function ShipmentTracker() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Result | null>(null);

  const run = useCallback(async (value: string, quiet = false) => {
    const clean = value.replace(/\s+/g, "").toUpperCase();
    if (!clean) return;
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/shop/courier-track?q=${encodeURIComponent(clean)}`, { cache: "no-store" });
      setData((await res.json()) as Result);
      window.history.replaceState(null, "", `/track?q=${encodeURIComponent(clean)}`);
    } catch {
      if (!quiet) setData({ ok: false, error: "Couldn't reach the tracking service. Try again." });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q") || params.get("awb") || params.get("order") || "";
    if (!initial) return;
    const timer = setTimeout(() => {
      setQuery(initial);
      void run(initial);
    }, 0);
    return () => clearTimeout(timer);
  }, [run]);

  useEffect(() => {
    if (!data?.ok || !query) return;
    const live = data.shipments?.some((s) => !["Delivered", "Cancelled", "Returned"].includes(s.status));
    if (!live) return;
    const timer = setInterval(() => void run(query, true), 60_000);
    return () => clearInterval(timer);
  }, [data, query, run]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,rgba(143,45,45,0.10),transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-burgundy/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-burgundy shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live shipment tracking
          </span>
          <h1 className="mt-4 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">Where&apos;s my parcel?</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Enter the AWB (tracking number) from your shipping message or your order ID. Works for Delhivery, India Post, DTDC, Ekart, Blue Dart and other couriers.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(query);
          }}
          className="mx-auto mt-7 flex max-w-2xl items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_40px_-18px_rgba(143,45,45,0.35)] focus-within:border-burgundy"
        >
          <svg viewBox="0 0 24 24" className="ml-2 h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="AWB or order ID, e.g. 19041979745464"
            className="min-w-0 flex-1 bg-transparent px-1 py-3 font-mono text-base tracking-wide text-slate-900 outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
          />
          <button type="submit" disabled={loading || query.trim().length < 6} className="rounded-xl bg-burgundy px-5 py-3 text-sm font-bold text-white transition hover:bg-burgundy/90 disabled:opacity-50">
            {loading ? "Tracking…" : "Track"}
          </button>
        </form>

        <div className="mt-8 space-y-6">
          {loading && !data ? <div className="h-48 animate-pulse rounded-3xl bg-slate-100" /> : null}
          {data && !data.ok ? (
            <div className={`rounded-2xl border p-5 text-sm ${data.ownFleet ? "border-sky-200 bg-sky-50 text-sky-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <p className="font-semibold">{data.error}</p>
              {data.ownFleet ? <Link href="/account/orders" className="mt-3 inline-block rounded-lg bg-burgundy px-4 py-2 text-xs font-bold text-white">Open My Orders</Link> : null}
            </div>
          ) : null}
          {data?.ok
            ? data.shipments?.map((shipment, i) => <ShipmentCard key={shipment.awb} shipment={shipment} index={i} total={data.shipments?.length ?? 1} />)
            : null}
          {data?.ok && data.checkedAt ? <p className="text-center text-[11px] text-slate-400">Checked with the courier at {statusStamp(data.checkedAt)} · refreshes every minute while in transit</p> : null}
        </div>
      </div>
    </div>
  );
}
