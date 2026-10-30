"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { formatDateTime } from "@/lib/utils";
import type { ShipmentEvent } from "@/types";

export type PipelineTone = "emerald" | "sky" | "red";

export interface PipelineStageShape {
  id: string;
  label: string;
  caption?: string;
  reached: boolean;
  partial: boolean;
  events: ShipmentEvent[];
  expected?: string;
  courierNote?: { title: string; detail: string };
}

interface VerticalPipelineProps {
  stages: PipelineStageShape[];
  currentIndex?: number;
  failed?: boolean;
  metaFor?: (stage: PipelineStageShape) => string;
  timingFor?: (stage: PipelineStageShape) => { label: string; tone: PipelineTone } | null;
  note?: string;
}

const ICONS: Record<string, string> = {
  ordered: "M8 4h8v3H8zM7 7h10v13H7zM9 12h6M9 16h4",
  packed: "M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8M12 12v8",
  shipped: "M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 18a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM18 18a1.5 1.5 0 110-3 1.5 1.5 0 010 3z",
  out: "M5 17a2 2 0 110-4 2 2 0 010 4zM16 17a2 2 0 110-4 2 2 0 010 4zM7 15h7l2-5H10M14 10l2 5M9 8h5",
  delivered: "M5 12l5 5L20 7",
  ready: "M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8M12 12v8",
  picked: "M5 12l5 5L20 7",
  cancelled: "M6 6l12 12M18 6L6 18",
  failed: "M6 6l12 12M18 6L6 18",
  Submitted: "M8 4h8v3H8zM7 7h10v13H7zM9 12h6M9 16h4",
  "Under Review": "M4 6h16M4 12h10M4 18h14",
  Approved: "M5 12l5 5L20 7",
  Confirmed: "M5 12l5 5L20 7",
  Rejected: "M6 6l12 12M18 6L6 18",
};

function iconPath(id: string) {
  return ICONS[id] || ICONS.ordered;
}

function pipeState(stage: PipelineStageShape, isCurrent: boolean): "done" | "active" | "upcoming" {
  if (stage.partial || (isCurrent && !stage.reached)) return "active";
  if (stage.reached && isCurrent) return "active";
  if (stage.reached) return "done";
  return "upcoming";
}

export default function VerticalPipeline({
  stages,
  currentIndex,
  failed,
  metaFor,
  timingFor,
  note,
}: VerticalPipelineProps) {
  const lastReachedIdx = stages.map((stage) => stage.reached).lastIndexOf(true);
  const partialIdx = stages.findIndex((stage) => stage.partial);
  const nodeCurrentIdx = currentIndex ?? (partialIdx !== -1 ? partialIdx : lastReachedIdx);
  const signature = `${stages.map((stage) => `${stage.id}:${stage.reached ? 1 : 0}:${stage.partial ? 1 : 0}`).join("|")}#${nodeCurrentIdx}`;
  const [grows, setGrows] = useState<number[]>(() => stages.map(() => 0));
  const [openIdx, setOpenIdx] = useState(Math.max(0, nodeCurrentIdx));
  const [drawMs, setDrawMs] = useState<number[]>(() => stages.map(() => 0));

  useEffect(() => {
    setOpenIdx(Math.max(0, nodeCurrentIdx));
  }, [nodeCurrentIdx]);

  useEffect(() => {
    const targets = stages.map((stage, index) => {
      const state = pipeState(stage, index === nodeCurrentIdx);
      return state === "done" ? 1 : state === "active" ? 0.55 : 0;
    });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDrawMs(targets.map(() => 0));
      setGrows(targets);
      return;
    }
    setDrawMs(targets.map(() => 0));
    setGrows(targets.map(() => 0));
    let index = 0;
    let timer = 0;
    const next = () => {
      if (index >= targets.length) return;
      const target = targets[index];
      if (target <= 0) {
        index += 1;
        next();
        return;
      }
      const ms = target >= 1 ? 2200 : 6500;
      setDrawMs((current) => current.map((value, i) => (i === index ? ms : value)));
      const step = index;
      window.requestAnimationFrame(() => {
        setGrows((current) => current.map((value, i) => (i === step ? target : value)));
      });
      index += 1;
      timer = window.setTimeout(next, ms);
    };
    const start = window.requestAnimationFrame(next);
    return () => {
      window.cancelAnimationFrame(start);
      window.clearTimeout(timer);
    };
    // Restart only when courier/application progress actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const firstUpcoming = stages.findIndex((stage, index) => pipeState(stage, index === nodeCurrentIdx) === "upcoming");

  return (
    <div className="vgmf-trk">
      {note ? <p className="vgmf-trk-note">{note}</p> : null}
      <ol className="vgmf-ship-pipe" role="list">
        {stages.map((stage, index) => {
          const state = pipeState(stage, index === nodeCurrentIdx);
          const open = openIdx === index;
          const timing = timingFor?.(stage);
          const stamp = metaFor?.(stage) || "";
          const kids = stage.events;
          const failedStep = Boolean(failed && (stage.id === "failed" || stage.id === "Rejected" || stage.id === "cancelled"));
          const nextHint = index === firstUpcoming && stage.caption ? stage.caption : "";
          return (
            <li
              key={stage.id}
              className={`${state}${failedStep ? " is-failed" : ""}`}
              style={
                {
                  "--i": index,
                  "--grow": String(grows[index] ?? 0),
                  "--draw": `${drawMs[index] ?? 0}ms`,
                } as CSSProperties
              }
            >
              {state === "active" && !failedStep ? <span className="vgmf-headway" aria-hidden="true" /> : null}
              <span className="dot" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d={iconPath(stage.id)} />
                </svg>
              </span>
              <div className="vgmf-ship-copy">
                <div className="vgmf-ship-title">
                  <b>{stage.label}</b>
                  {stamp && state !== "upcoming" ? <span className="vgmf-ship-time">{stamp}</span> : null}
                </div>
                {stage.caption && state !== "upcoming" ? <div className="vgmf-ship-msg">{stage.caption}</div> : null}
                {nextHint && state === "upcoming" ? <div className="vgmf-ship-next">Up next · {nextHint}</div> : null}
                {timing && state !== "upcoming" ? (
                  <span className={`vgmf-ship-expect${timing.tone === "red" ? " is-late" : ""}`}>{timing.label}</span>
                ) : null}
                {stage.expected && state !== "done" ? <span className="vgmf-ship-expect">{stage.expected}</span> : null}
                {stage.courierNote && state !== "upcoming" ? (
                  <div className="vgmf-ship-courier">
                    <b>{stage.courierNote.title}</b>
                    <span>{stage.courierNote.detail}</span>
                  </div>
                ) : null}
                {kids.length ? (
                  <button
                    type="button"
                    className="vgmf-ship-drawer-btn"
                    aria-expanded={open}
                    onClick={() => setOpenIdx(open ? -1 : index)}
                  >
                    {kids.length} update{kids.length > 1 ? "s" : ""} {open ? "▴" : "▾"}
                  </button>
                ) : null}
                {open && kids.length ? (
                  <ul className="vgmf-ship-kids">
                    {kids.map((event) => (
                      <li key={event.id} className={/fail|undeliver|rto/i.test(event.title) ? "failed" : ""}>
                        <b>{event.title}</b>
                        {event.at ? <div className="when">{formatDateTime(event.at)}</div> : null}
                        {event.location ? <div className="where">{event.location}</div> : null}
                        {event.detail ? <div className="where">{event.detail}</div> : null}
                        {event.agent?.name || event.agent?.phone ? (
                          <div className="where">
                            Agent: {[event.agent?.name, event.agent?.phone].filter(Boolean).join(" · ")}
                            {event.otp ? ` · Delivery OTP ${event.otp}` : ""}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
