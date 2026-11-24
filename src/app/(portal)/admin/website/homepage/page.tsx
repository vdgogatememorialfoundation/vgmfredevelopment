"use client";

import { useState } from "react";
import { SiteModuleHub } from "@/components/admin/SiteModules";
import { SupportUsDesk } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";
import { getSettings, saveSettings } from "@/lib/admin-store";
import { publishLiveSite } from "@/lib/mobile-publish";

const DEFAULT_TAGLINE = "Ayurveda education, publications and clinical care.";

function TaglineEditorCard() {
  const initial = getSettings();
  const [tagline, setTagline] = useState(initial.tagline || DEFAULT_TAGLINE);
  const [footerText, setFooterText] = useState(initial.chrome?.footerText || "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const save = async () => {
    setBusy(true);
    setNote("");
    try {
      const current = getSettings();
      const cleanTagline = tagline.trim();
      const cleanFooter = footerText.trim();
      saveSettings({
        ...current,
        tagline: cleanTagline || DEFAULT_TAGLINE,
        chrome: {
          ...(current.chrome ?? {}),
          footerText: cleanFooter || undefined,
        },
      });
      await publishLiveSite().catch(() => undefined);
      setNote("Tagline saved & published live to Hero, Footer, and Mobile App.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save tagline.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Site &amp; Footer Tagline</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Edit the Foundation tagline (default: &ldquo;{DEFAULT_TAGLINE}&rdquo;) shown in the homepage hero, site footer, and mobile app.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save & publish tagline"}
        </button>
      </div>
      {note ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{note}</p> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Main Tagline (Hero, Footer &amp; App)</span>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder={DEFAULT_TAGLINE}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Footer-only Tagline Override (optional)</span>
          <input
            type="text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Leave blank to use the Main Tagline above"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <div className="space-y-8">
      <ClientOnly>
        <TaglineEditorCard />
      </ClientOnly>
      <ClientOnly>
        <SupportUsDesk />
      </ClientOnly>
      <SiteModuleHub />
    </div>
  );
}
