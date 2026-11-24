"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { accountNavigation } from "@/lib/constants";
import { publishLiveSite } from "@/lib/mobile-publish";
import { allStaffModules } from "@/lib/roles";
import { developingKey, getSiteText, homeSections, saveSiteText } from "@/lib/site-text";
import {
  getSiteVisibility,
  publicSitePages,
  saveSiteVisibility,
  subscribeSiteVisibility,
  type SiteVisibility,
} from "@/lib/site-visibility";

function snapshot() {
  return JSON.stringify(getSiteVisibility());
}

export function SiteVisibilityDesk() {
  useSyncExternalStore(subscribeSiteVisibility, snapshot, () => "{}");
  const saved = getSiteVisibility();
  const [draft, setDraft] = useState<SiteVisibility>(saved);
  const [developing, setDeveloping] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.entries(getSiteText().developing ?? {}).filter((entry): entry is [string, true] => entry[1] === true))
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const staff = useMemo(() => allStaffModules(), []);

  const toggle = (surface: keyof SiteVisibility, id: string, enabled: boolean) => {
    setDraft((current) => ({ ...current, [surface]: { ...current[surface], [id]: enabled } }));
  };

  const markDeveloping = (key: string, enabled: boolean) => {
    setDeveloping((current) => {
      const next = { ...current };
      if (enabled) next[key] = true;
      else delete next[key];
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Site & portal switches</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Tick Show to keep a page in the menu. Tick Under development to leave it in the menu and show an under-development notice instead of the section. Untick Show to hide it. Admin can still open everything from this console.
        </p>
      </div>
      {note && <p className="text-sm text-emerald-700">{note}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Homepage sections</h2>
        <p className="mt-1 text-sm text-slate-500">A ticked section stays on the homepage and shows “Under development” in place of its content.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {homeSections.map((section) => (
            <Tick
              key={section.id}
              label={section.label}
              hint="Under development"
              checked={developing[developingKey("home", section.id)] === true}
              onChange={(enabled) => markDeveloping(developingKey("home", section.id), enabled)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Frontend website</h2>
        <p className="mt-1 text-sm text-slate-500">Header, footer and direct URLs on vaidyagogate.org.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {publicSitePages.map((page) => (
            <Row
              key={page.id}
              label={page.label}
              hint={page.href}
              shown={draft.public[page.id] !== false}
              developing={developing[developingKey("page", page.id)] === true}
              onShow={(enabled) => toggle("public", page.id, enabled)}
              onDeveloping={(enabled) => markDeveloping(developingKey("page", page.id), enabled)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Staff portal</h2>
        <p className="mt-1 text-sm text-slate-500">Modules on /staff and in the staff workspace menu.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {staff.map((moduleItem) => (
            <Tick
              key={moduleItem.id}
              label={moduleItem.label}
              hint={moduleItem.paths[0]}
              checked={draft.staff[moduleItem.id] !== false}
              onChange={(enabled) => toggle("staff", moduleItem.id, enabled)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Customer dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">Pages in My Account.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {accountNavigation.map((item) => (
            <Row
              key={item.href}
              label={item.name}
              hint={item.href}
              shown={draft.account[item.href] !== false}
              developing={developing[developingKey("account", item.href)] === true}
              onShow={(enabled) => toggle("account", item.href, enabled)}
              onDeveloping={(enabled) => markDeveloping(developingKey("account", item.href), enabled)}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          saveSiteVisibility(draft);
          const text = getSiteText();
          saveSiteText({ ...text, developing });
          void publishLiveSite().then((result) => {
            setBusy(false);
            setNote(
              result.ok
                ? "Saved and published. Under-development sections now show that notice on the website."
                : "Saved in this browser. Publishing did not complete; it will retry on the next save."
            );
          });
        }}
      >
        {busy ? "Saving…" : "Save switches"}
      </button>
    </div>
  );
}

function Row({
  label,
  hint,
  shown,
  developing,
  onShow,
  onDeveloping,
}: {
  label: string;
  hint?: string;
  shown: boolean;
  developing: boolean;
  onShow: (value: boolean) => void;
  onDeveloping: (value: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800">{label}</p>
      {hint && <p className="font-mono text-[11px] text-slate-400">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-burgundy" checked={shown} onChange={(event) => onShow(event.target.checked)} />
          Show
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-burgundy" checked={developing} onChange={(event) => onDeveloping(event.target.checked)} />
          Under development
        </label>
      </div>
    </div>
  );
}

function Tick({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-burgundy" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="font-semibold text-slate-800">{label}</span>
        {hint && <span className="block font-mono text-[11px] text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}
