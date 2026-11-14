"use client";

import { deliveryDatePhrase } from "@/lib/delivery-expectation";
import type { Order, ShipmentRecord } from "@/types";

const STEPS = ["Order placed", "Rider assigned", "Picked up", "On the way", "Delivered"] as const;

function stepFor(order: Order, shipment?: ShipmentRecord | null) {
  const text = `${shipment?.status ?? ""} ${[...(shipment?.tracking ?? [])].reverse().find((scan) => scan.status)?.status ?? ""}`.toLowerCase();
  if (order.status === "Delivered" || shipment?.status === "Delivered" || /\bdelivered|successful|completed\b/.test(text)) return 4;
  if (order.status === "Out for Delivery" || shipment?.status === "Out for Delivery" || /on the way|out for delivery|started|arriv/.test(text)) return 3;
  if (shipment?.status === "Picked Up" || shipment?.status === "In Transit" || /picked up|collected/.test(text)) return 2;
  if (shipment?.agentName?.trim() || /assigned|accepted/.test(text)) return 1;
  return 0;
}

const HEADLINES = [
  "Your order is confirmed. Finding a delivery partner…",
  "Rider assigned and heading to the store",
  "Rider has picked up your order",
  "Your order is on the way",
  "Delivered. Enjoy your order!",
];

/** Food-delivery style card for local rider orders: one headline, ETA, rider and a short progress bar. */
export default function HyperlocalStatus({ order, shipment }: { order: Order; shipment?: ShipmentRecord | null }) {
  const step = stepFor(order, shipment);
  const done = step === 4;
  const eta = !done && shipment?.expectedBy ? deliveryDatePhrase(shipment.expectedBy) : "";
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <p className={`text-lg font-bold ${done ? "text-emerald-700" : "text-slate-900"}`}>{HEADLINES[step]}</p>
      {eta ? <p className="mt-0.5 text-sm text-slate-600">Arriving by {eta}</p> : null}
      <div className="mt-3 flex items-center gap-1" aria-label={`Progress: ${STEPS[step]}`}>
        {STEPS.map((label, index) => (
          <span key={label} title={label} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-emerald-600" : "bg-slate-200"} ${index === step && !done ? "animate-pulse" : ""}`} />
        ))}
      </div>
      <p className="mt-1.5 text-xs font-semibold text-emerald-700">{STEPS[step]}</p>
      {shipment?.agentName && !done ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{shipment.agentName}</span>
            <span className="block text-xs text-slate-600">Your delivery partner</span>
          </span>
          {shipment.agentPhone ? (
            <a href={`tel:${shipment.agentPhone}`} className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
              Call
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
