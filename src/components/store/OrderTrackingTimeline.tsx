"use client";

import { useEffect, useState } from "react";
import { classNames, formatDate, formatDateTime } from "@/lib/utils";
import { storeConfig } from "@/lib/constants";
import { buildTrackingStages, getReturnRequest, pickupOtp } from "@/lib/store";
import type { Order, ShipmentEvent } from "@/types";

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

type TimingTone = "emerald" | "sky" | "red";

export default function OrderTrackingTimeline({ order }: { order: Order }) {
  const { stages, reachedEvents, totalEvents } = buildTrackingStages(order);
  const returnRequest = getReturnRequest(order.id) ?? order.returnRequest;

  const partialIdx = stages.findIndex((stage) => stage.partial);
  const lastReachedIdx = stages
    .map((stage) => stage.reached)
    .lastIndexOf(true);
  const nodeCurrentIdx =
    partialIdx !== -1
      ? partialIdx
      : order.status !== "Delivered"
        ? lastReachedIdx
        : -1;

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setNow(new Date());
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const courier = order.courierName ?? storeConfig.courierName;
  const trackingId = order.trackingId;

  const placed = new Date(order.date);
  const expectedFrom = addDays(placed, storeConfig.orderPreparationDays + 2);
  const expectedTo = addDays(
    placed,
    storeConfig.orderPreparationDays + storeConfig.defaultDeliveryDays
  );

  const packedStage = stages.find((stage) => stage.id === "packed");
  const shippedStage = stages.find((stage) => stage.id === "shipped");
  const deliveredStage = stages.find(
    (stage) => stage.id === "delivered" || stage.id === "picked"
  );
  const dispatchedAt = packedStage?.events[packedStage.events.length - 1]?.at;
  const shippedAt = shippedStage?.events.find((e) => e.id === "shipped")?.at;
  const deliveredAt =
    deliveredStage?.events[deliveredStage.events.length - 1]?.at;

  const stageTiming = (
    stage: PipelineStageShape
  ): { label: string; tone: TimingTone } | null => {
    const nowTime = now?.getTime();
    if (stage.id === "shipped" || stage.id === "out") {
      if (!stage.reached || !nowTime) return null;
      return nowTime > expectedTo.getTime()
        ? { label: "Delayed", tone: "red" }
        : { label: "On time", tone: "sky" };
    }
    if (stage.id === "delivered") {
      if (!stage.reached || !deliveredAt) return null;
      const deliveredTime = new Date(deliveredAt).getTime();
      return deliveredTime < expectedFrom.getTime()
        ? { label: "Arriving early", tone: "emerald" }
        : deliveredTime <= expectedTo.getTime()
          ? { label: "On time", tone: "sky" }
          : { label: "Delayed", tone: "red" };
    }
    return null;
  };

  const stageDateLine = (stage: PipelineStageShape): string => {
    switch (stage.id) {
      case "ordered":
        return `Ordered on ${formatDate(order.date)}`;
      case "packed":
        return stage.reached && dispatchedAt
          ? `Dispatched on ${formatDate(dispatchedAt)}`
          : `Dispatch expected by ${formatDate(expectedFrom)}`;
      case "shipped":
        return stage.reached && shippedAt
          ? `Date of shipping: ${formatDate(shippedAt)} · Expected by ${formatDate(expectedTo)}`
          : `Expected to deliver by ${formatDate(expectedTo)}`;
      case "out":
        return `Delivery expected by ${formatDate(expectedTo)}`;
      case "delivered":
        return stage.reached && deliveredAt
          ? `Delivered on ${formatDate(deliveredAt)}`
          : `Delivery expected by ${formatDate(expectedTo)}`;
      case "ready":
        return stage.reached
          ? `Pickup OTP: ${pickupOtp(order.id)} · Valid ${storeConfig.pickupHoldingDays} days`
          : `Ready within ${storeConfig.orderPreparationDays} day of packing`;
      case "picked":
        return stage.reached && deliveredAt
          ? `Picked up on ${formatDate(deliveredAt)}`
          : "Awaiting collection";
      case "cancelled":
        return `Cancelled on ${formatDate(order.date)}`;
      default:
        return "";
    }
  };

  const rr = returnRequest;
  const returnPipeline = rr
    ? {
        stages: rr.stages.map((event) => ({
          id: event.id,
          label: event.title,
          caption: event.location,
          reached: !!event.reached,
          partial: false,
          events: [event],
        })),
        reachedEvents: rr.stages.filter((event) => event.reached)
          .length,
        totalEvents: rr.stages.length,
      }
    : null;

  return (
    <div>
      {/* Courier summary */}
      {order.deliveryMode === "delivery" && trackingId && (
        <p className="mb-4 rounded-lg bg-warm-cream px-3 py-2 text-xs text-text-muted">
          Courier: <span className="font-semibold text-text-primary">{courier}</span>{" "}
          · Tracking id:{" "}
          <span className="font-mono font-semibold text-text-primary">
            {trackingId}
          </span>
        </p>
      )}

      <PipelineTimeline
        stages={stages}
        reachedEvents={reachedEvents}
        totalEvents={totalEvents}
        nodeCurrentIdxOverride={nodeCurrentIdx}
        metaFor={stageDateLine}
        timingFor={stageTiming}
      />

      <p className="mt-2 rounded-xl bg-warm-cream p-3 text-xs text-text-muted">
        {order.status === "Cancelled"
          ? "This order was cancelled — refund will be initiated to your original payment method within 3–5 business days."
          : order.status === "Delivered"
            ? "Delivered — confirmation received on the courier site. Agent details remain hidden after delivery."
            : order.status === "Out for Delivery"
              ? "Your order is Out for delivery. Keep your phone handy — the delivery agent will call you."
              : order.deliveryMode === "store_pickup"
                ? "Pickup orders do not go through the courier. We will notify you on WhatsApp when your item is ready."
                : "Tap a stage to view its updates."}
      </p>

      {/* Return / replacement tracking — same pipeline */}
      {returnPipeline && rr && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-text-primary">
              {rr.kind === "replacement"
                ? "Replacement tracking"
                : "Return tracking"}
            </p>
            <span
              className={classNames(
                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                rr.status === "Refunded" ||
                  rr.status === "Picked Up"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-burgundy/10 text-burgundy"
              )}
            >
              {rr.status}
            </span>
          </div>
          <PanelDivider />
          <div className="mt-4">
            <PipelineTimeline
              stages={returnPipeline.stages}
              reachedEvents={returnPipeline.reachedEvents}
              totalEvents={returnPipeline.totalEvents}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PanelDivider() {
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
    </div>
  );
}

/* ---------- Generic pipeline ---------- */

interface PipelineStageShape {
  id: string;
  label: string;
  caption?: string;
  reached: boolean;
  partial: boolean;
  events: ShipmentEvent[];
}

interface PipelineTimelineProps {
  stages: PipelineStageShape[];
  reachedEvents: number;
  totalEvents: number;
  nodeCurrentIdxOverride?: number;
  metaFor?: (stage: PipelineStageShape) => string;
  timingFor?: (
    stage: PipelineStageShape
  ) => { label: string; tone: TimingTone } | null;
}

function PipelineTimeline({
  stages,
  reachedEvents,
  totalEvents,
  nodeCurrentIdxOverride,
  metaFor,
  timingFor,
}: PipelineTimelineProps) {
  const partialIdx = stages.findIndex((stage) => stage.partial);
  const lastReachedIdx = stages
    .map((stage) => stage.reached)
    .lastIndexOf(true);
  const nodeCurrentIdx =
    nodeCurrentIdxOverride !== undefined
      ? nodeCurrentIdxOverride
      : partialIdx !== -1
        ? partialIdx
        : lastReachedIdx;

  const [activeIdx, setActiveIdx] = useState(Math.max(0, lastReachedIdx));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setProgress(reachedEvents);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [reachedEvents]);

  const fill = totalEvents === 0 ? 0 : (progress / totalEvents) * 100;

  const cumulative = stages.map(
    (_stage, i) =>
      stages.slice(0, i).reduce((sum, s) => sum + s.events.length, 0)
  );

  return (
    <div>
      {/* Desktop · horizontal pipeline */}
      <div className="hidden md:block">
        <div className="relative">
          <div
            className="absolute top-[10px]"
            style={{
              left: `${100 / (stages.length * 2)}%`,
              right: `${100 / (stages.length * 2)}%`,
            }}
          >
            <div className="relative h-[3px] rounded-full">
              <div className="absolute inset-0 border-t-2 border-dashed border-border" />
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-emerald-500 transition-all duration-[1200ms] ease-linear"
                style={{ width: `${Math.min(100, fill)}%` }}
              />
            </div>
          </div>
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
            }}
          >
            {stages.map((stage, i) => {
              const selected = i === activeIdx;
              const timing = timingFor?.(stage);
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className="flex flex-col items-center"
                  aria-pressed={selected}
                >
                  <NodeState state={nodeState(stage, i === nodeCurrentIdx)} />
                  <span
                    className={classNames(
                      "mt-2 text-center text-sm font-bold",
                      selected
                        ? "text-burgundy"
                        : stage.reached
                          ? "text-text-primary"
                          : "text-text-muted"
                    )}
                  >
                    {stage.label}
                  </span>
                  {stage.caption && (
                    <span
                      className={classNames(
                        "mt-0.5 text-center text-xs leading-tight font-medium",
                        stage.reached ? "text-text-muted" : "text-text-muted/70"
                      )}
                    >
                      {stage.caption}
                    </span>
                  )}
                  {(metaFor?.(stage) || timing) && (
                    <span className="mt-1 text-center text-[11px] leading-tight font-semibold text-text-muted">
                      {metaFor?.(stage)}
                      {timing && (
                        <span className={timingToneClass(timing.tone)}>
                          {" "}
                          · {timing.label}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected stage content */}
        <div className="mt-6">
          <StageContent
            stage={stages[activeIdx]}
            timing={timingFor?.(stages[activeIdx]) ?? null}
          />
        </div>
      </div>

      {/* Mobile · vertical pipeline */}
      <div className="md:hidden">
        {stages.map((stage, i) => {
          const open = i === activeIdx;
          const timing = timingFor?.(stage);
          return (
            <div key={stage.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <NodeState state={nodeState(stage, i === nodeCurrentIdx)} />
                {i < stages.length - 1 && (
                  <span className="relative my-1 h-6 w-0.5 overflow-hidden">
                    <span className="absolute inset-0 border-l-2 border-dashed border-border" />
                    <span
                      className="absolute top-0 left-0 h-full w-full bg-emerald-500 transition-all duration-[1200ms] ease-linear"
                      style={{
                        height: `${segmentFraction(progress, cumulative[i]) * 100}%`,
                      }}
                    />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 pb-5">
                <button
                  type="button"
                  onClick={() => setActiveIdx(open ? -1 : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="min-w-0">
                    <span
                      className={classNames(
                        "block text-sm font-bold",
                        open
                          ? "text-burgundy"
                          : stage.reached
                            ? "text-text-primary"
                            : "text-text-muted"
                      )}
                    >
                      {stage.label}
                    </span>
                    {stage.caption && (
                      <span className="block text-xs font-medium text-text-muted">
                        {stage.caption}
                      </span>
                    )}
                    {(metaFor?.(stage) || timing) && (
                      <span className="mt-0.5 block text-[11px] leading-snug font-semibold text-text-muted">
                        {metaFor?.(stage)}
                        {timing && (
                          <span className={timingToneClass(timing.tone)}>
                            {" "}
                            · {timing.label}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={classNames(
                      "shrink-0 text-text-muted transition-transform duration-200",
                      open && "rotate-180"
                    )}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {open && (
                  <div className="mt-3">
                    <StageContent stage={stage} timing={timing ?? null} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Stage helpers ---------- */

type NodeStatus = "reached" | "current" | "future";

function nodeState(
  stage: PipelineStageShape,
  current: boolean
): NodeStatus {
  if (stage.reached) return current ? "current" : "reached";
  if (stage.partial) return "current";
  return "future";
}

function NodeState({ state }: { state: NodeStatus }) {
  return (
    <span
      className={classNames(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
        state === "reached" && "border-emerald-500 bg-emerald-500 text-white",
        state === "current" &&
          "border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-2 ring-emerald-200",
        state === "future" && "border-border bg-white"
      )}
    >
      {state === "reached" ? (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : state === "current" ? (
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-border" />
      )}
    </span>
  );
}

function StageContent({
  stage,
  timing,
}: {
  stage: PipelineStageShape;
  timing: { label: string; tone: TimingTone } | null;
}) {
  const statusLabel = stage.reached
    ? "Done"
    : stage.partial
      ? "In progress"
      : "Upcoming";

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <p className="font-semibold text-text-primary">
          {stage.label}
          {stage.caption && (
            <span className="ml-2 text-xs font-normal text-text-muted">
              {stage.caption}
            </span>
          )}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          {timing && (
            <span
              className={classNames(
                "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
                timing.tone === "emerald" && "bg-emerald-50 text-emerald-700",
                timing.tone === "sky" && "bg-burgundy/10 text-burgundy",
                timing.tone === "red" && "bg-red-50 text-red-600"
              )}
            >
              {timing.label}
            </span>
          )}
          <span
            className={classNames(
              "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
              stage.reached
                ? "bg-emerald-50 text-emerald-700"
                : stage.partial
                  ? "bg-burgundy/10 text-burgundy"
                  : "bg-warm-cream text-text-muted"
            )}
          >
            {statusLabel}
          </span>
        </span>
      </div>

      {stage.events.length === 0 ? (
        <p className="text-xs italic text-text-muted">No updates yet.</p>
      ) : (
        <EventList stage={stage} />
      )}
    </div>
  );
}

function EventList({ stage }: { stage: PipelineStageShape }) {
  return (
    <ul className="space-y-3">
      {stage.events.map((event) => (
        <EventItem key={event.id} event={event} />
      ))}
    </ul>
  );
}

function EventItem({ event }: { event: ShipmentEvent }) {
  const reached = !!event.reached;

  return (
    <li
      className={classNames(
        "flex gap-2.5 transition-opacity duration-700",
        reached ? "opacity-100" : "opacity-50"
      )}
    >
      <span
        className={classNames(
          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
          reached ? "bg-emerald-500" : "bg-border"
        )}
      />
      <div className="min-w-0">
        <p
          className={classNames(
            "text-sm leading-snug font-semibold",
            reached ? "text-text-primary" : "text-text-muted"
          )}
        >
          {event.title}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-text-muted">
          {formatDateTime(event.at)}
          {event.location && <span> — {event.location}</span>}
        </p>
        {event.detail && (
          <p className="mt-0.5 text-xs leading-snug text-text-muted">
            {event.detail}
          </p>
        )}
        {event.agent && (
          <p className="mt-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
            Agent: {event.agent.name} · {event.agent.phone}
            {event.otp && (
              <span>
                {" "}
                · Delivery OTP:{" "}
                <span className="font-mono">{event.otp}</span>
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

function segmentFraction(progress: number, eventsBefore: number) {
  return progress === 0
    ? 0
    : Math.max(0, Math.min(1, progress - eventsBefore - 1));
}

const TIMING_TONE_CLASSES: Record<TimingTone, string> = {
  emerald: "font-semibold text-emerald-600",
  sky: "font-semibold text-burgundy",
  red: "font-semibold text-red-500",
};

function timingToneClass(tone: TimingTone) {
  return TIMING_TONE_CLASSES[tone];
}