"use client";

import { useState } from "react";

export default function ProductShare({ slug, title, price }: { slug: string; title: string; price?: number }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}/shop/${slug}`;
  const text = price ? `${title} · ₹${price.toLocaleString("en-IN")}` : title;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this product link", link());
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: link() });
        return;
      } catch {
        return;
      }
    }
    void copy();
  };

  const pill =
    "inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-text-primary transition hover:border-burgundy hover:text-burgundy";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void share()} className={pill} aria-label="Share this product">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Share
      </button>
      <button
        type="button"
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${link()}`)}`, "_blank", "noopener,noreferrer")}
        className={pill}
      >
        WhatsApp
      </button>
      <button type="button" onClick={() => void copy()} className={pill}>
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
