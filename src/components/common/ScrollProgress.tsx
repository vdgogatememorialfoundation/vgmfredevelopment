"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { classNames } from "@/lib/utils";

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const showTop = progress > 0.15;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-burgundy via-gold to-sage"
        style={{ transform: `scaleX(${progress})` }}
      />
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={classNames(
          "fixed bottom-6 left-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-burgundy shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-burgundy hover:text-white",
          showTop
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        <ArrowUp size={18} />
      </button>
    </>
  );
}
