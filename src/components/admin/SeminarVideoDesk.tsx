"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    loadVideoLibraryAdmin?: (focus?: string) => void;
  }
}

export function SeminarVideoDesk() {
  useEffect(() => {
    const cssId = "vgmf-seminar-office-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "/office/seminar-videos.css";
      document.head.appendChild(link);
    }
    const start = () => window.loadVideoLibraryAdmin?.();
    const removeCss = () => document.getElementById(cssId)?.remove();
    const existing = document.querySelector("script[data-vgmf-seminar-office]");
    if (existing) {
      start();
      return removeCss;
    }
    const script = document.createElement("script");
    script.src = "/office/seminar-videos.js";
    script.async = true;
    script.dataset.vgmfSeminarOffice = "1";
    script.onload = () => start();
    document.body.appendChild(script);
    return removeCss;
  }, []);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-gray-900">Seminar videos</h1>
      <div id="vl-admin-root" className="mt-4">
        <p className="text-sm text-gray-500">Loading seminar videos…</p>
      </div>
    </section>
  );
}
