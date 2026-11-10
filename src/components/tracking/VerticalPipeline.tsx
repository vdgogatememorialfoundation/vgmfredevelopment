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
  /** 0–1 share of the gap to the next step already covered by the courier's hubs (seller hub → city hubs → buyer hub). */
  hubShare?: number;
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
  hubShare = 0,
}: VerticalPipelineProps) {
  const lastReachedIdx = stages.map((stage) => stage.reached).lastIndexOf(true);
  const partialIdx = stages.map((stage) => stage.partial).lastIndexOf(true);
  const nodeCurrentIdx = currentIndex ?? (partialIdx !== -1 ? partialIdx : lastReachedIdx);
  const [openIdx, setOpenIdx] = useState(Math.max(0, nodeCurrentIdx));
  const frameRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const phase = useRef<"start" | "to-step" | "at-step">("start");
  const shownIdx = useRef(-1);
  const readRef = useRef<(() => { left: number; top: number; reached: number; height: number } | null) | null>(null);
  const [line, setLine] = useState({ left: 14.5, top: 34, height: 0, transition: "none" });
  const [litIdx, setLitIdx] = useState(-1);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);
  const terminal = new Set(["delivered", "picked", "failed", "cancelled", "refunded"]);
  const current = stages[nodeCurrentIdx];
  // Time may carry the line into the open gap. It stays short of the next step until that step is reached.
  // Past the current step the line always shows a short lead, then grows with the courier's expected timing.
  const creep =
    !current ||
    terminal.has(current.id) ||
    nodeCurrentIdx >= stages.length - 1 ||
    stages[nodeCurrentIdx + 1]?.reached
      ? 0
      : Math.min(
          0.9,
          Math.max(
            hubShare,
            !pace || pace.until <= pace.from ? 0.15 : Math.max(0.15, Math.min(0.8, (now - pace.from) / (pace.until - pace.from)))
          )
        );
  const creepRef = useRef(creep);
  creepRef.current = creep;

  useEffect(() => {
    setOpenIdx(Math.max(0, nodeCurrentIdx));
  }, [nodeCurrentIdx]);

  useEffect(() => {
    const list = listRef.current;
    const frame = frameRef.current;
    if (!list || !frame || nodeCurrentIdx < 0) return;
    // A new status replays the line from the first step instead of jumping from where it was.
    if (shownIdx.current !== nodeCurrentIdx) {
      shownIdx.current = nodeCurrentIdx;
      phase.current = "start";
    }
    let cancelled = false;
    let growTimer = 0;
    let creepTimer = 0;
    let litFrame = 0;
    // Each dot turns green on the very frame the moving line reaches it.
    const lightAlong = (seconds: number) => {
      window.cancelAnimationFrame(litFrame);
      const items = [...list.querySelectorAll<HTMLElement>(":scope > li")].slice(0, nodeCurrentIdx + 1);
      const fill = frame.querySelector<HTMLElement>(".vgmf-ship-fill");
      const until = performance.now() + seconds * 1000 + 300;
      const tick = () => {
        if (cancelled) return;
        const end = fill ? fill.getBoundingClientRect().bottom : 0;
        let reached = -1;
        items.forEach((item, index) => {
          const box = item.querySelector(".dot")?.getBoundingClientRect();
          if (box && end >= box.top + 1) reached = index;
        });
        if (seconds <= 0 || performance.now() >= until) reached = nodeCurrentIdx;
        if (reached >= 0) setLitIdx((was) => Math.max(was, reached));
        if (reached < nodeCurrentIdx) litFrame = window.requestAnimationFrame(tick);
      };
      litFrame = window.requestAnimationFrame(tick);
    };
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
      // The line follows the courier scans inside the current step, down to the latest one.
      // At a final step (Delivered, Picked Up…) the line ends on its dot, not on the scans listed under it.
      const finalStep = terminal.has(stages[nodeCurrentIdx]?.id ?? "") || nodeCurrentIdx >= stages.length - 1;
      const latestScan = finalStep ? undefined : [...(step?.querySelectorAll<HTMLElement>(".vgmf-ship-kids > li") ?? [])].pop();
      const scanBox = latestScan?.getBoundingClientRect();
      const bottom = Math.max(
        end.top + end.height / 2 - frameBox.top,
        scanBox ? scanBox.top + 10 - frameBox.top : 0
      );
      const reached = Math.max(0, bottom - top);
      const nextDot = items[nodeCurrentIdx + 1]?.querySelector(".dot");
      let height = reached;
      const portion = creepRef.current;
      if (nextDot && portion > 0 && !finalStep) {
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
        lightAlong(0);
        return;
      }
      if (phase.current === "start") {
        paint({ ...next, height: 0 }, "none");
        setLitIdx(-1);
        window.clearTimeout(growTimer);
        window.clearTimeout(creepTimer);
        growTimer = window.setTimeout(() => {
          if (cancelled) return;
          const latest = read();
          if (!latest) return;
          phase.current = "to-step";
          paint({ ...latest, height: latest.reached }, `height ${statusSeconds}s linear`);
          lightAlong(statusSeconds);
          settleCreep();
        }, 70);
        return;
      }
      window.clearTimeout(creepTimer);
      phase.current = "to-step";
      paint({ ...next, height: next.reached }, `height ${statusSeconds}s linear`);
      lightAlong(statusSeconds);
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
      window.cancelAnimationFrame(litFrame);
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
              className={`${state}${failedStep ? " is-failed" : ""}${index <= litIdx ? " lit" : ""}`}
              style={{ "--i": index } as CSSProperties}
            >
              <span className="dot" aria-hidden="true" />
              <div className="vgmf-ship-copy">
                <div className="vgmf-ship-title">
                  <span className="vgmf-ship-label">
                    <b>{stage.label}</b>
                    {timing && state !== "upcoming" ? (
                      <span className={`vgmf-ship-expect is-inline${timing.tone === "red" ? " is-late" : ""}`}>{timing.label}</span>
                    ) : null}
                  </span>
                  {stamp && state !== "upcoming" ? <span className="vgmf-ship-time">{stamp}</span> : null}
                </div>
                {stage.caption && state !== "upcoming" ? <div className="vgmf-ship-msg">{stage.caption}</div> : null}
                {nextHint && state === "upcoming" ? <div className="vgmf-ship-next">{nextHint}</div> : null}
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
