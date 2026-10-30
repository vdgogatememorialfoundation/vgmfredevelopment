"use client";

import { useEffect, useState } from "react";
import { classNames, formatDateTime } from "@/lib/utils";
import type { ShipmentEvent } from "@/types";

export type PipelineTone = "emerald" | "sky" | "red";

export interface PipelineStageShape {
  id: string;
  label: string;
  caption?: string;
  reached: boolean;
  partial: boolean;
  events: ShipmentEvent[];
}

interface VerticalPipelineProps {
  stages: PipelineStageShape[];
  currentIndex?: number;
  failed?: boolean;
  metaFor?: (stage: PipelineStageShape) => string;
  timingFor?: (stage: PipelineStageShape) => { label: string; tone: PipelineTone } | null;
}

export default function VerticalPipeline({
  stages,
  currentIndex,
  failed,
  metaFor,
  timingFor,
}: VerticalPipelineProps) {
  const lastReachedIdx = stages.map((stage) => stage.reached).lastIndexOf(true);
  const partialIdx = stages.findIndex((stage) => stage.partial);
  const nodeCurrentIdx =
    currentIndex ?? (partialIdx !== -1 ? partialIdx : lastReachedIdx);
  const targetFill = fillFor(stages, nodeCurrentIdx);
  const [fill, setFill] = useState(0);
  const [openIdx, setOpenIdx] = useState(Math.max(0, nodeCurrentIdx));

  useEffect(() => {
    setOpenIdx(Math.max(0, nodeCurrentIdx));
  }, [nodeCurrentIdx]);

  useEffect(() => {
    let frame = 0;
    const from = fill;
    const to = targetFill;
    if (Math.abs(to - from) < 0.002) {
      setFill(to);
      return;
    }
    const started = performance.now();
    const duration = 2200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - t) ** 3;
      setFill(from + (to - from) * eased);
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
    // Only restart when the courier-driven target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFill]);

  return (
    <ol className="relative" role="list">
      <span aria-hidden="true" className="absolute top-2 bottom-2 left-[11px] w-0.5 overflow-hidden rounded-full">
        <span className="absolute inset-0 bg-border" />
        <span
          className={classNames(
            "absolute top-0 left-0 w-full origin-top rounded-full",
            failed ? "bg-red-500" : "bg-emerald-500"
          )}
          style={{ height: `${Math.round(fill * 1000) / 10}%` }}
        />
      </span>
      {stages.map((stage, index) => {
        const open = openIdx === index;
        const timing = timingFor?.(stage);
        const state = nodeState(stage, index === nodeCurrentIdx);
        return (
          <li key={stage.id} className="relative flex gap-3 pb-6 last:pb-0">
            <NodeState state={state} failed={failed && stage.id === "failed"} />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? -1 : index)}
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-2 text-left"
              >
                <span className="min-w-0">
                  <span
                    className={classNames(
                      "block text-sm font-bold",
                      open ? "text-burgundy" : stage.reached ? "text-text-primary" : "text-text-muted"
                    )}
                  >
                    {stage.label}
                  </span>
                  {stage.caption ? (
                    <span className="mt-0.5 block text-xs font-medium text-text-muted">{stage.caption}</span>
                  ) : null}
                  {(metaFor?.(stage) || timing) && (
                    <span className="mt-0.5 block text-[11px] leading-snug font-semibold text-text-muted">
                      {metaFor?.(stage)}
                      {timing ? <span className={timingToneClass(timing.tone)}> · {timing.label}</span> : null}
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
                  className={classNames("mt-0.5 shrink-0 text-text-muted transition-transform duration-200", open && "rotate-180")}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {open ? (
                <div className="mt-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <p className="font-semibold text-text-primary">{stage.label}</p>
                    <span
                      className={classNames(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
                        stage.reached
                          ? failed && stage.id === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-emerald-50 text-emerald-700"
                          : stage.partial
                            ? "bg-burgundy/10 text-burgundy"
                            : "bg-warm-cream text-text-muted"
                      )}
                    >
                      {stage.reached ? "Done" : stage.partial ? "In progress" : "Waiting for courier"}
                    </span>
                  </div>
                  {stage.events.length === 0 ? (
                    <p className="text-xs italic text-text-muted">
                      {stage.reached ? "Reached." : "This step moves only when the courier posts an update."}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {stage.events.map((event) => (
                        <EventItem key={event.id} event={event} />
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function fillFor(stages: PipelineStageShape[], currentIdx: number) {
  if (stages.length <= 1) return stages[0]?.reached ? 1 : 0;
  const reached = stages.filter((stage) => stage.reached).length;
  const partial = stages.some((stage) => stage.partial);
  const index = Math.max(reached - 1, currentIdx >= 0 && stages[currentIdx]?.reached ? currentIdx : reached - 1, 0);
  const extra = partial ? 0.4 : stages[index]?.id && !stages[index].reached ? 0 : 0;
  return Math.max(0, Math.min(1, (index + extra) / (stages.length - 1)));
}

type NodeStatus = "reached" | "current" | "future";

function nodeState(stage: PipelineStageShape, current: boolean): NodeStatus {
  if (stage.reached) return current ? "current" : "reached";
  if (stage.partial) return "current";
  return "future";
}

function NodeState({ state, failed }: { state: NodeStatus; failed?: boolean }) {
  return (
    <span
      className={classNames(
        "relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white",
        failed && "border-red-500 text-red-600",
        !failed && state === "reached" && "border-emerald-500 bg-emerald-500 text-white",
        !failed && state === "current" && "border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-2 ring-emerald-200",
        !failed && state === "future" && "border-border text-text-muted"
      )}
    >
      {state === "reached" ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : state === "current" ? (
        <span className={classNames("h-2.5 w-2.5 rounded-full", failed ? "bg-red-500" : "bg-emerald-500")} />
      ) : (
        <span className="h-2 w-2 rounded-full bg-border" />
      )}
    </span>
  );
}

function EventItem({ event }: { event: ShipmentEvent }) {
  const reached = !!event.reached;
  return (
    <li className={classNames("flex gap-2.5", reached ? "opacity-100" : "opacity-50")}>
      <span className={classNames("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", reached ? "bg-emerald-500" : "bg-border")} />
      <div className="min-w-0">
        <p className={classNames("text-sm leading-snug font-semibold", reached ? "text-text-primary" : "text-text-muted")}>
          {event.title}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-text-muted">
          {event.at ? formatDateTime(event.at) : ""}
          {event.location ? <span> — {event.location}</span> : null}
        </p>
        {event.detail ? <p className="mt-0.5 text-xs leading-snug text-text-muted">{event.detail}</p> : null}
        {event.agent?.name || event.agent?.phone ? (
          <p className="mt-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
            Agent: {[event.agent?.name, event.agent?.phone].filter(Boolean).join(" · ")}
            {event.otp ? (
              <span>
                {" "}
                · Delivery OTP: <span className="font-mono">{event.otp}</span>
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </li>
  );
}

const TIMING_TONE_CLASSES: Record<PipelineTone, string> = {
  emerald: "font-semibold text-emerald-600",
  sky: "font-semibold text-burgundy",
  red: "font-semibold text-red-500",
};

function timingToneClass(tone: PipelineTone) {
  return TIMING_TONE_CLASSES[tone];
}
