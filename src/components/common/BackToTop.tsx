"use client";

import { useEffect, useState } from "react";

function scrollY() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(scrollY() > 240);
    update();
    const timer = window.setInterval(update, 200);
    window.addEventListener("scroll", update, { passive: true });
    document.addEventListener("scroll", update, { passive: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", update);
      document.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-4 bottom-[6.75rem] z-40 flex h-12 w-12 items-center justify-center rounded-full border border-gold bg-burgundy text-white shadow-[0_10px_24px_rgba(111,31,31,0.28)] transition hover:bg-burgundy-dark sm:right-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
