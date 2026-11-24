"use client";

import { useCallback, useEffect, useState } from "react";

type TrackStage = {
  id: string;
  title: string;
  reached: boolean;
  current: boolean;
  at?: string;
  detail?: string;
  events?: { at: string; title: string; location: string }[];
};

type TrackData = {
  kind: "forward" | "return";
  awb: string;
  orderId: string;
  courier: string;
  status: string;
  expectedBy?: string;
  destination: string;
  stages: TrackStage[];
  scans: { at: string; title: string; location: string }[];
};

function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VgmfLogisticsTracker() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<TrackData | null>(null);
  const [copied, setCopied] = useState(false);

  const runLookup = useCallback(async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/logistics/track?awb=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Shipment not found.");
      setData(j);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not find shipment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("awb") || params.get("order") || params.get("q") || "";
    if (initial) {
      setQuery(initial);
      void runLookup(initial);
    }
  }, [runLookup]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("awb", query.trim());
      window.history.replaceState({}, "", url.toString());
    }
    void runLookup(query.trim());
  };

  const copyLink = () => {
    if (!data) return;
    const link = `${window.location.origin}/track-shipment?awb=${encodeURIComponent(data.awb || data.orderId)}`;
    void navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-widest text-burgundy">VGMF Logistics · Shipment Tracking</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Track Your Shipment</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your 12-digit VGMF AWB number or Order ID to view live parcel status.
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            className="flex-1 min-w-[220px] rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-sm font-semibold text-slate-900 outline-none focus:border-burgundy"
            placeholder="Enter 12-digit AWB (e.g. 882611211001) or Order ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-burgundy px-5 py-2.5 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Tracking…" : "Track Shipment"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
      </div>

      {data && (
        <div className="mt-6 space-y-5">
          {/* Shipment Summary Strip */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{data.courier}</p>
                <p className="mt-0.5 font-mono text-lg font-extrabold text-slate-900">
                  {data.awb ? `AWB ${data.awb}` : `Order #${data.orderId}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Order <span className="font-mono font-bold">#{data.orderId}</span>
                  {data.destination ? ` · Destination: ${data.destination}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-900">
                  {data.status}
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  {copied ? "Link Copied ✓" : "Copy Tracking Link"}
                </button>
              </div>
            </div>
            {data.expectedBy && data.status !== "Delivered" && (
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-950">
                Expected delivery by {data.expectedBy}
              </p>
            )}
          </div>

          {/* 5-Stage Order-Style Visual Pipeline Tracker */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
              {data.kind === "return" ? "Return Tracking Pipeline" : "Live Shipment Pipeline"}
            </h2>
            <ol className="relative ml-3 mt-5 border-l-2 border-slate-200 pl-6 space-y-6">
              {data.stages.map((st) => (
                <li key={st.id} className="relative">
                  <span
                    className={`absolute -left-[35px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white shadow-sm ${
                      st.reached
                        ? st.current
                          ? "bg-blue-600 ring-4 ring-blue-100"
                          : "bg-emerald-600"
                        : "bg-slate-300"
                    }`}
                  >
                    {st.reached ? "✓" : "•"}
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className={`text-sm font-extrabold ${st.reached ? "text-slate-900" : "text-slate-400"}`}>
                      {st.title}
                    </p>
                    {st.at && <span className="font-mono text-xs text-slate-500">{fmtTime(st.at)}</span>}
                  </div>
                  {st.detail && <p className="mt-0.5 text-xs text-slate-600">{st.detail}</p>}

                  {st.events && st.events.length > 0 && (
                    <ul className="mt-2.5 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      {st.events.map((ev, i) => (
                        <li key={i} className="border-b border-slate-200/70 pb-1.5 text-xs last:border-0 last:pb-0">
                          <p className="font-semibold text-slate-800">{ev.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {fmtTime(ev.at)}{ev.location ? ` · ${ev.location}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
