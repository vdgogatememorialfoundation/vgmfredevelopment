"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { accountNavigation } from "@/lib/constants";
import { allStaffModules } from "@/lib/roles";
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
  const [note, setNote] = useState("");
  const staff = useMemo(() => allStaffModules(), []);

  const toggle = (surface: keyof SiteVisibility, id: string, enabled: boolean) => {
    setDraft((current) => ({ ...current, [surface]: { ...current[surface], [id]: enabled } }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Site & portal switches</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Tick to show a page. Untick to hide it from the public website, the staff portal, or the customer dashboard. Admin can still open everything from this console.
        </p>
      </div>
      {note && <p className="text-sm text-emerald-700">{note}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Frontend website</h2>
        <p className="mt-1 text-sm text-slate-500">Header, footer and direct URLs on vaidyagogate.org.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {publicSitePages.map((page) => (
            <Tick
              key={page.id}
              label={page.label}
              hint={page.href}
              checked={draft.public[page.id] !== false}
              onChange={(enabled) => toggle("public", page.id, enabled)}
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
            <Tick
              key={item.href}
              label={item.name}
              hint={item.href}
              checked={draft.account[item.href] !== false}
              onChange={(enabled) => toggle("account", item.href, enabled)}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white"
        onClick={() => {
          saveSiteVisibility(draft);
          setNote("Visibility saved. The public site, staff portal and customer dashboard update immediately.");
        }}
      >
        Save switches
      </button>
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
