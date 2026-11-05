"use client";

import { useSiteText } from "@/lib/use-site-text";

export default function SiteDisclaimers() {
  const rows = (useSiteText().disclaimers ?? []).filter((row) => row.enabled);
  if (!rows.length) return null;
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
