"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classNames } from "@/lib/utils";

/** Horizontal row with ‹ › buttons so people can tell it scrolls sideways. */
export function ScrollRow({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frame = window.requestAnimationFrame(measure);
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const move = (direction: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-xl font-bold text-burgundy shadow-md";

  return (
    <div className={classNames("relative", className)}>
      {edges.left ? (
        <button type="button" aria-label="Scroll left" className={classNames(arrow, "left-0")} onClick={() => move(-1)}>
          ‹
        </button>
      ) : null}
      <nav ref={ref} aria-label={label} className={classNames("flex gap-2 overflow-x-auto scroll-smooth py-1", edges.left && "pl-10", edges.right && "pr-10")}>
        {children}
      </nav>
      {edges.right ? (
        <button type="button" aria-label="Scroll right" className={classNames(arrow, "right-0")} onClick={() => move(1)}>
          ›
        </button>
      ) : null}
    </div>
  );
}
