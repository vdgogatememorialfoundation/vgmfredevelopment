"use client";

import { useSiteText } from "@/lib/use-site-text";

export default function SiteDisclaimers({ placement = "bottom" }: { placement?: "top" | "bottom" }) {
  const rows = (useSiteText().disclaimers ?? []).filter(
    (row) => row.enabled && ((row.placement ?? "bottom") === placement || row.placement === "both")
  );
  if (!rows.length) return null;
  if (placement === "top") {
    return (
      <section aria-label="Disclaimers" className="border-b border-gold/30 bg-white px-4 py-2 text-center text-xs leading-relaxed text-ink">
        {rows.map((row) => (
          <p key={row.id}>
            {row.title ? <b className="mr-1">{row.title}:</b> : null}
            <span className="whitespace-pre-line text-text-muted">{row.body}</span>
          </p>
        ))}
      </section>
    );
  }
  return (
    <section aria-label="Disclaimers" className="mt-6 space-y-2 border-t border-gold/30 pt-4">
      {rows.map((row) => (
        <div key={row.id} className="text-xs leading-relaxed text-text-muted">
          {row.title ? <p className="font-semibold text-ink">{row.title}</p> : null}
          {row.body ? <p className="whitespace-pre-line">{row.body}</p> : null}
        </div>
      ))}
    </section>
  );
}
