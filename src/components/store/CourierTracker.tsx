"use client";

import { useEffect, useState } from "react";
import VerticalPipeline, { type PipelineStageShape } from "@/components/tracking/VerticalPipeline";
import { statusStamp } from "@/lib/delivery-expectation";

type Result = {
  ok?: boolean;
  error?: string;
  courier?: string;
  awb?: string;
  status?: string;
  expectedBy?: string;
  destination?: string;
  stages?: PipelineStageShape[];
};

export default function CourierTracker() {
  const [awb, setAwb] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setBusy(true);
    setMessage("");
    setData(null);
    try {
      const response = await fetch(`/api/shop/courier-track?awb=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const json = (await response.json()) as Result;
      if (!response.ok || !json.ok) {
        setMessage(json.error || "No courier shipment matches that tracking number.");
        return;
      }
      setData(json);
      window.history.replaceState(null, "", `/courier-tracking?awb=${encodeURIComponent(clean)}`);
    } catch {
      setMessage("Tracking could not be loaded. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("awb") || "";
    if (!fromLink) return;
    const timer = setTimeout(() => {
      setAwb(fromLink);
      void lookup(fromLink);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const stages = data?.stages ?? [];
  const current = Math.max(0, stages.map((stage) => stage.reached || stage.partial).lastIndexOf(true));

  return (
    <div className="container py-8">
      <h1 className="font-serif text-3xl text-ink">Track a courier shipment</h1>
      <p className="mt-2 max-w-xl text-sm text-text-muted">
        Enter the tracking (AWB) number from your shipping message, for parcels sent with a courier such as Delhivery, India Post or DTDC.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(awb);
        }}
        className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-text-primary">Tracking (AWB) number</span>
          <input
            value={awb}
            onChange={(event) => setAwb(event.target.value)}
            required
            className="w-full rounded-xl border border-border bg-white px-3 py-3 font-mono"
          />
        </label>
        <button type="submit" disabled={busy} className="rounded-full bg-burgundy px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Checking…" : "Track"}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}
      {data ? (
        <div className="mt-6 max-w-3xl rounded-2xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gold">{data.courier}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-ink">AWB {data.awb}</p>
              <p className="mt-1 text-xs text-text-muted">
                {data.destination ? `To ${data.destination}` : ""}
                {data.expectedBy ? `${data.destination ? " · " : ""}Expected by ${data.expectedBy}` : ""}
              </p>
            </div>
            <span className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-xs font-semibold text-burgundy">{data.status}</span>
          </div>
          <div className="mt-4">
            <VerticalPipeline
              stages={stages}
              currentIndex={current}
              metaFor={(stage) => {
                const at = [...stage.events].reverse().find((event) => event.at)?.at;
                return stage.reached && at ? statusStamp(at) : "";
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
