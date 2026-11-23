"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import VerticalPipeline, { type PipelineStageShape } from "@/components/tracking/VerticalPipeline";
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

function ShipmentCard({ shipment, index, total }: { shipment: Shipment; index: number; total: number }) {
  const [copied, setCopied] = useState(false);
  const pct = progress(shipment.stages);
  const current = Math.max(0, shipment.stages.map((s) => s.reached).lastIndexOf(true));
  const live = !["Delivered", "Cancelled", "Returned"].includes(shipment.status);
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
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-burgundy/[0.06] via-white to-sky-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {total > 1 ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-burgundy">Shipment {index + 1} of {total}</p> : null}
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{shipment.courier}</p>
            <p className="mt-0.5 font-mono text-2xl font-bold tracking-wide text-slate-900">{shipment.awb}</p>
            <p className="mt-1 text-xs text-slate-500">Order {shipment.orderId}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ${tone(shipment.status)}`}>
              {live ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                </span>
              ) : null}
              {shipment.status}
            </span>
            <button onClick={share} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-burgundy hover:text-burgundy">
              {copied ? "Link copied" : "Share tracking"}
            </button>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-burgundy via-rose-500 to-amber-400 transition-[width] duration-1000" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 hidden grid-flow-col gap-1 sm:grid" style={{ gridTemplateColumns: `repeat(${shipment.stages.length}, minmax(0, 1fr))` }}>
            {shipment.stages.map((stage) => (
              <div key={stage.id} className="text-center">
                <span className={`mx-auto block h-2 w-2 rounded-full ${stage.reached ? "bg-burgundy" : stage.partial ? "bg-amber-400" : "bg-slate-200"}`} />
                <span className={`mt-1 block text-[10.5px] font-semibold ${stage.reached ? "text-slate-800" : "text-slate-400"}`}>{stage.label}</span>
              </div>
            ))}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Destination", shipment.destination || "—"],
            ["Expected delivery", shipment.status === "Delivered" ? "Delivered" : shipment.expectedBy || "Updating"],
            ["Latest scan", shipment.lastEvent ? `${shipment.lastEvent.status}${shipment.lastEvent.location ? ` · ${shipment.lastEvent.location}` : ""}` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-white/80 p-3">
              <dt className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
              {label === "Latest scan" && shipment.lastEvent ? <dd className="text-[11px] text-slate-500">{statusStamp(shipment.lastEvent.at)}</dd> : null}
            </div>
          ))}
        </dl>
      </div>
      <div className="p-5 sm:p-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Journey</p>
        <VerticalPipeline
          stages={shipment.stages}
          currentIndex={current}
          metaFor={(stage) => {
            const at = [...stage.events].reverse().find((event) => event.at)?.at;
            return stage.reached && at ? statusStamp(at) : "";
          }}
        />
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
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
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
          className="mt-7 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_40px_-18px_rgba(143,45,45,0.35)] focus-within:border-burgundy"
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
