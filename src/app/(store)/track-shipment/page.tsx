"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import VerticalPipeline, { type PipelineStageShape } from "@/components/tracking/VerticalPipeline";
import { rememberShipment } from "@/lib/commerce-sync";
import type { Order, ShipmentRecord } from "@/types";

type TrackStage = {
  id: string;
  title: string;
  reached: boolean;
  current: boolean;
  at?: string;
  detail?: string;
};

type TrackResult = {
  ok: boolean;
  kind: "forward" | "return";
  awb: string;
  orderId: string;
  courier: string;
  status: string;
  expectedBy?: string;
  destination?: string;
  order?: Order;
  shipment?: ShipmentRecord;
  stages?: TrackStage[];
  scans: { at: string; title: string; location: string }[];
  error?: string;
};

function fmtTime(iso?: string) {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TrackShipmentInner() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("awb") || searchParams.get("order") || searchParams.get("q") || "";
  const [query, setQuery] = useState(initial);
  const [data, setData] = useState<TrackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const lookup = useCallback(async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/logistics/track?awb=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const json = (await res.json()) as TrackResult;
      if (!res.ok || !json.ok) {
        setData(null);
        setError(json.error || "VGMF Logistics shipment not found.");
      } else {
        if (json.shipment) {
          rememberShipment(json.shipment);
        }
        setData(json);
      }
    } catch {
      setError("Network error while tracking shipment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial) void lookup(initial);
  }, [initial, lookup]);

  const shareUrl = typeof window !== "undefined" && data
    ? `${window.location.origin}/track-shipment?awb=${encodeURIComponent(data.awb || data.orderId)}`
    : "";

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-1.5">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
            VGMF Logistics · Own Fleet Tracking
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Track Your VGMF Shipment</h1>
          <p className="text-sm text-slate-600">
            Enter your 12-digit VGMF Express AWB number (88... / 89...) or VGMF-shipped Order ID.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(query);
          }}
          className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 882611210001"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? "Tracking..." : "Track Shipment"}
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 space-y-1.5">
            <p>{error}</p>
            <Link href="/track" className="inline-block text-xs font-bold underline text-red-800">
              Go to External Courier Order Tracking (/track) →
            </Link>
          </div>
        )}

        {data && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{data.courier}</p>
                <h2 className="text-lg font-extrabold text-slate-900 font-mono">
                  {data.awb ? `AWB ${data.awb}` : `Order #${data.orderId}`}
                </h2>
                <p className="text-xs text-slate-500">
                  Order #{data.orderId}{data.destination ? ` · Destination: ${data.destination}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${/delivered|returned/i.test(data.status) ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                  {data.status}
                </span>
                {shareUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    {copied ? "Tracking Link Copied ✓" : "Copy Tracking Link"}
                  </button>
                )}
              </div>
            </div>

            {data.kind === "forward" && data.order ? (
              <OrderTrackingTimeline
                order={data.order}
                shipmentId={data.shipment?.id || ""}
                detailed
              />
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">Return / RTO Live Pipeline</p>
                {(() => {
                  const vpStages: PipelineStageShape[] = (data.stages || []).map((st, idx) => ({
                    id: st.id || `tr-${idx}`,
                    label: st.title,
                    caption: st.detail || undefined,
                    reached: Boolean(st.reached),
                    partial: false,
                    events: st.reached
                      ? [{ id: `tr-ev-${idx}`, title: st.detail || st.title, at: st.at || "", reached: true }]
                      : [],
                    courierNote: idx === 1 && data.awb ? { title: data.courier, detail: `Return AWB: ${data.awb}` } : undefined,
                  }));
                  const curIdx = Math.max(0, vpStages.map((s) => s.reached).lastIndexOf(true));
                  return (
                    <VerticalPipeline
                      stages={vpStages}
                      currentIndex={curIdx}
                      metaFor={(s) => (s.reached && s.events[0]?.at ? fmtTime(s.events[0].at) : "")}
                      timingFor={(s) =>
                        s.reached && s.id === vpStages[vpStages.length - 1]?.id
                          ? { label: "Completed", tone: "emerald" }
                          : s.reached && s.id === vpStages[curIdx]?.id
                            ? { label: data.status, tone: "emerald" }
                            : null
                      }
                    />
                  );
                })()}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>Vaidya Gogate Memorial Foundation · VGMF Logistics</span>
              <Link href="/" className="font-bold text-emerald-700 hover:underline">Back to Store →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackShipmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-10 text-center text-sm text-slate-500">Loading shipment tracker...</div>}>
      <TrackShipmentInner />
    </Suspense>
  );
}
