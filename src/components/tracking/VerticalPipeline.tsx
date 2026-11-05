"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { statusDay, statusStamp } from "@/lib/delivery-expectation";
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
  /** Delivery country. India stays on IST. Any other country uses UTC. */
  country?: string;
  /** Milliseconds. The line creeps from the current step toward the next one until `until`. */
  pace?: { from: number; until: number } | null;
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
  "cancel-review": "M4 6h16M4 12h10M4 18h14",
  refunded: "M5 12l5 5L20 7",
  failed: "M6 6l12 12M18 6L6 18",
  Submitted: "M8 4h8v3H8zM7 7h10v13H7zM9 12h6M9 16h4",
  "Under Review": "M4 6h16M4 12h10M4 18h14",
  Approved: "M5 12l5 5L20 7",
  Confirmed: "M5 12l5 5L20 7",
  Rejected: "M6 6l12 12M18 6L6 18",
  Pending: "M12 7v5l3 3M12 21a9 9 0 110-18 9 9 0 010 18z",
  Paid: "M4 7h16v10H4zM4 11h16",
  Issued: "M6 4h9l5 5v11H6z",
  "E-ticket": "M2 9a3 3 0 010 6v2a2 2 0 002 2h16a2 2 0 002-2v-2a3 3 0 000-6V7a2 2 0 00-2-2H4a2 2 0 00-2 2z",
  "Checked in": "M5 12l5 5L20 7",
  Certificate: "M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7z",
  "Certificate issued": "M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7z",
  Expired: "M12 7v5l3 3M12 21a9 9 0 110-18 9 9 0 010 18z",
  "Pre-registration": "M8 4h8v3H8zM7 7h10v13H7z",
  "Main registration": "M4 6h16M4 12h10M4 18h14",
  Draft: "M6 4h9l5 5v11H6zM15 4v5h5",
  Shortlisted: "M5 12l5 5L20 7",
  Waitlisted: "M12 7v5l3 3M12 21a9 9 0 110-18 9 9 0 010 18z",
  Accepted: "M5 12l5 5L20 7",
  Invalid: "M6 6l12 12M18 6L6 18",
  Cancelled: "M6 6l12 12M18 6L6 18",
};

function iconPath(id: string) {
  return ICONS[id] || ICONS.ordered;
}

function pipeState(stage: PipelineStageShape, isCurrent: boolean): "done" | "active" | "upcoming" {
  if (stage.partial || (isCurrent && !stage.reached)) return "active";
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
  country,
  pace,
}: VerticalPipelineProps) {
  const lastReachedIdx = stages.map((stage) => stage.reached).lastIndexOf(true);
  const partialIdx = stages.map((stage) => stage.partial).lastIndexOf(true);
  const nodeCurrentIdx = currentIndex ?? (partialIdx !== -1 ? partialIdx : lastReachedIdx);
  const [openIdx, setOpenIdx] = useState(Math.max(0, nodeCurrentIdx));
  const frameRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const phase = useRef<"start" | "to-step" | "at-step">("start");
  const readRef = useRef<(() => { left: number; top: number; reached: number; height: number } | null) | null>(null);
  const [line, setLine] = useState({ left: 14.5, top: 34, height: 0, transition: "none" });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);
  const terminal = new Set(["delivered", "picked", "failed", "cancelled", "refunded"]);
  const current = stages[nodeCurrentIdx];
  // Time may carry the line into the open gap. It stays short of the next step until that step is reached.
  const creep =
    !pace ||
    !current ||
    terminal.has(current.id) ||
    nodeCurrentIdx >= stages.length - 1 ||
    stages[nodeCurrentIdx + 1]?.reached ||
    pace.until <= pace.from
      ? 0
      : Math.max(0, Math.min(0.42, (now - pace.from) / (pace.until - pace.from)));
  const creepRef = useRef(creep);
  creepRef.current = creep;

  useEffect(() => {
    setOpenIdx(Math.max(0, nodeCurrentIdx));
  }, [nodeCurrentIdx]);

  useEffect(() => {
    const list = listRef.current;
    const frame = frameRef.current;
    if (!list || !frame || nodeCurrentIdx < 0) return;
    let cancelled = false;
    let growTimer = 0;
    let creepTimer = 0;
    const read = () => {
      const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
      const step = items[nodeCurrentIdx];
      const firstDot = items[0]?.querySelector(".dot");
      const currentDot = step?.querySelector(".dot");
      if (!firstDot || !currentDot) return null;
      const frameBox = frame.getBoundingClientRect();
      const start = firstDot.getBoundingClientRect();
      const end = currentDot.getBoundingClientRect();
      const top = start.top + start.height / 2 - frameBox.top;
      const bottom = end.top + end.height / 2 - frameBox.top;
      const reached = Math.max(0, bottom - top);
      const nextDot = items[nodeCurrentIdx + 1]?.querySelector(".dot");
      let height = reached;
      const portion = creepRef.current;
      if (nextDot && portion > 0) {
        const nextBox = nextDot.getBoundingClientRect();
        const nextCenter = nextBox.top + nextBox.height / 2 - frameBox.top;
        height += Math.max(0, nextCenter - bottom) * portion;
      }
      return {
        left: start.left + start.width / 2 - frameBox.left - 1.5,
        top,
        reached,
        height,
      };
    };
    readRef.current = read;
    const motion = (duration: string) =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "none" : duration;
    const paint = (next: { left: number; top: number; height: number }, duration: string) => {
      setLine({ left: next.left, top: next.top, height: next.height, transition: motion(duration) });
    };
    const statusSeconds = Math.min(8, Math.max(2.2, nodeCurrentIdx * 2.2));
    const settleCreep = () => {
      creepTimer = window.setTimeout(() => {
        if (cancelled) return;
        const crept = read();
        if (!crept) return;
        phase.current = "at-step";
        const extra = crept.height - crept.reached;
        paint(crept, extra > 2 ? "height 24s linear" : "none");
      }, statusSeconds * 1000 + 40);
    };
    const apply = () => {
      const next = read();
      if (!next || cancelled) return;
      if (motion("height 1s linear") === "none") {
        phase.current = "at-step";
        paint(next, "none");
        return;
      }
      if (phase.current === "start") {
        paint({ ...next, height: 0 }, "none");
        window.clearTimeout(growTimer);
        window.clearTimeout(creepTimer);
        growTimer = window.setTimeout(() => {
          if (cancelled) return;
          const latest = read();
          if (!latest) return;
          phase.current = "to-step";
          paint({ ...latest, height: latest.reached }, `height ${statusSeconds}s linear`);
          settleCreep();
        }, 70);
        return;
      }
      window.clearTimeout(creepTimer);
      phase.current = "to-step";
      paint({ ...next, height: next.reached }, `height ${statusSeconds}s linear`);
      settleCreep();
    };
    const timer = window.setTimeout(apply, 40);
    const follow = () => {
      if (cancelled || phase.current === "start") return;
      const next = read();
      if (!next) return;
      setLine((currentLine) => ({ ...currentLine, left: next.left, top: next.top }));
    };
    const observer = new ResizeObserver(follow);
    observer.observe(list);
    window.addEventListener("resize", follow);
    return () => {
      cancelled = true;
      readRef.current = null;
      window.clearTimeout(timer);
      window.clearTimeout(growTimer);
      window.clearTimeout(creepTimer);
      observer.disconnect();
      window.removeEventListener("resize", follow);
    };
  }, [nodeCurrentIdx, openIdx, stages.length]);

  useEffect(() => {
    if (phase.current !== "at-step") return;
    const next = readRef.current?.();
    if (!next) return;
    const transition = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "none" : "height 10s linear";
    setLine({ left: next.left, top: next.top, height: next.height, transition });
  }, [creep]);

  const firstUpcoming = stages.findIndex((stage, index) => pipeState(stage, index === nodeCurrentIdx) === "upcoming");

  return (
    <div className="vgmf-trk">
      {note ? <p className="vgmf-trk-note">{note}</p> : null}
      <div className="vgmf-ship-frame" ref={frameRef}>
        <span
          className={`vgmf-ship-fill${failed ? " is-failed" : ""}`}
          style={{ left: line.left, top: line.top, height: line.height, transition: line.transition }}
          aria-hidden="true"
        />
        <ol ref={listRef} className="vgmf-ship-pipe" role="list">
        {stages.map((stage, index) => {
          const state = pipeState(stage, index === nodeCurrentIdx);
          const timing = timingFor?.(stage);
          const stamp = metaFor?.(stage) || "";
          const kids = stage.events;
          const failedStep = Boolean(
            failed && /fail|reject|invalid|cancel|expire/i.test(stage.id)
          );
          const promise = stages.find((item) => item.id === "delivered" || item.id === "picked")?.expected || "";
          const nextHint = index === firstUpcoming ? promise : "";
          return (
            <li
              key={stage.id}
              className={`${state}${failedStep ? " is-failed" : ""}`}
              style={{ "--i": index } as CSSProperties}
            >
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
                {nextHint && state === "upcoming" ? <div className="vgmf-ship-next">{nextHint}</div> : null}
                {timing && state !== "upcoming" ? (
                  <span className={`vgmf-ship-expect${timing.tone === "red" ? " is-late" : ""}`}>{timing.label}</span>
                ) : null}
                {stage.expected && state !== "done" && !(nextHint && state === "upcoming") ? (
                  <span className="vgmf-ship-expect">{stage.expected}</span>
                ) : null}
                {stage.courierNote && state !== "upcoming" ? (
                  <div className="vgmf-ship-courier">
                    <b>{stage.courierNote.title}</b>
                    <span>{stage.courierNote.detail}</span>
                  </div>
                ) : null}
                {kids.length ? (
                  <ul className="vgmf-ship-kids">
                    {kids.map((event) => (
                      <li key={event.id} className={/fail|undeliver|rto/i.test(event.title) ? "failed" : ""}>
                        <b>{event.title}</b>
                        {event.at ? <div className="when">{stage.id === "delivered" || stage.id === "picked" ? statusDay(event.at, country) : statusStamp(event.at, country)}</div> : null}
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
    </div>
  );
}
