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
        setError(json.error || "No Vaidya Gogate Memorial Foundation shipment matches that number.");
      } else {
        if (json.shipment) {
          rememberShipment(json.shipment);
        }
        setData(json);
      }
    } catch {
      setError("Tracking could not be loaded. Try again in a moment.");
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

  const returnStages: PipelineStageShape[] = (data?.stages || []).map((st, idx) => ({
    id: st.id || `tr-${idx}`,
    label: st.title,
    caption: st.detail || undefined,
    reached: Boolean(st.reached),
    partial: false,
    events: st.reached ? [{ id: `tr-ev-${idx}`, title: st.detail || st.title, at: st.at || "", reached: true }] : [],
  }));
  const returnIdx = Math.max(0, returnStages.map((st) => st.reached).lastIndexOf(true));

  return (
    <div className="container py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">VGMF Logistics</p>
      <h1 className="mt-1 font-serif text-3xl text-ink">Track your Vaidya Gogate Memorial Foundation shipment</h1>
      <p className="mt-2 max-w-xl text-sm text-text-muted">
        Enter the 12-digit Vaidya Gogate Memorial Foundation AWB number (starts with 88 or 89) or the order ID. Orders sent with other couriers are tracked in{" "}
        <Link href="/account/orders" className="font-semibold text-burgundy underline">My Orders</Link>.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(query);
        }}
        className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-text-primary">AWB number or order ID</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 882611210001"
            inputMode="numeric"
            className="w-full rounded-xl border border-border bg-white px-3 py-3 font-mono"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-full bg-burgundy px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Checking…" : "Track"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {data ? (
        <div className="mt-6 max-w-3xl rounded-2xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gold">{data.courier}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-ink">{data.awb ? `AWB ${data.awb}` : `Order ${data.orderId}`}</p>
              <p className="mt-1 text-xs text-text-muted">
                Order {data.orderId}
                {data.destination ? ` · To ${data.destination}` : ""}
                {data.expectedBy && !/delivered|returned/i.test(data.status) ? ` · Expected by ${data.expectedBy}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-xs font-semibold text-burgundy">{data.status}</span>
              {shareUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-xs font-semibold text-burgundy underline"
                >
                  {copied ? "Link copied" : "Copy tracking link"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            {data.kind === "forward" && data.order ? (
              <OrderTrackingTimeline order={data.order} shipmentId={data.shipment?.id || ""} detailed />
            ) : (
              <>
                <p className="mb-3 font-serif text-lg text-ink">Return pickup</p>
                <VerticalPipeline
                  stages={returnStages}
                  currentIndex={returnIdx}
                  metaFor={(st) => (st.reached && st.events[0]?.at ? fmtTime(st.events[0].at) : "")}
                />
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TrackShipmentPage() {
  return (
    <Suspense fallback={<div className="container py-8 text-sm text-text-muted">Loading the tracker…</div>}>
      <TrackShipmentInner />
    </Suspense>
  );
}
