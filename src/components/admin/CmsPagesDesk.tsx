"use client";

import { useState, useSyncExternalStore } from "react";
import { deleteCmsPage, getCmsPages, saveCmsPage, type CmsPage } from "@/lib/cms-pages";
import { subscribeCms } from "@/lib/cms";

function pagesSnapshot() {
  return JSON.stringify(getCmsPages());
}

export function CmsPagesDesk() {
  useSyncExternalStore(subscribeCms, pagesSnapshot, () => "[]");
  const pages = getCmsPages();
  const [editing, setEditing] = useState<Partial<CmsPage> | null>(null);
  const [note, setNote] = useState("");

  const startNew = () =>
    setEditing({
      title: "",
      slug: "",
      excerpt: "",
      body: "",
      enabled: false,
      showInNav: false,
      showInFooter: true,
    });

  const save = () => {
    if (!editing?.title?.trim()) {
      setNote("Add a page title.");
      return;
    }
    const saved = saveCmsPage({
      id: editing.id,
      title: editing.title,
      slug: editing.slug,
      excerpt: editing.excerpt,
      body: editing.body,
      enabled: Boolean(editing.enabled),
      showInNav: Boolean(editing.showInNav),
      showInFooter: Boolean(editing.showInFooter),
    });
    setEditing(saved);
    setNote(saved.enabled ? `Saved and live at /p/${saved.slug}.` : `Saved. Tick “Show on the main site” to publish /p/${saved.slug}.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pages</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Create pages, write the content, then tick to put them on the main site. Disabled pages stay in the admin list only.
          </p>
        </div>
        <button type="button" className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white" onClick={startNew}>
          New page
        </button>
      </div>
      {note && <p className="text-sm text-emerald-700">{note}</p>}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white">
          {pages.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No custom pages yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pages.map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(page)}
                    className={`flex w-full items-start justify-between gap-2 px-4 py-3 text-left text-sm ${editing?.id === page.id ? "bg-burgundy/5" : "hover:bg-slate-50"}`}
                  >
                    <span>
                      <span className="block font-semibold text-slate-900">{page.title}</span>
                      <span className="block font-mono text-[11px] text-slate-400">/p/{page.slug}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${page.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {page.enabled ? "On" : "Off"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {editing ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Title</span>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={editing.title ?? ""} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Slug</span>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm" value={editing.slug ?? ""} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} placeholder="optional — generated from the title" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Short summary</span>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={editing.excerpt ?? ""} onChange={(event) => setEditing({ ...editing, excerpt: event.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Page content</span>
              <textarea className="min-h-56 w-full rounded-lg border border-slate-200 px-3 py-2 leading-6" value={editing.body ?? ""} onChange={(event) => setEditing({ ...editing, body: event.target.value })} />
            </label>
            <div className="grid gap-2">
              <Tick label="Show on the main site" hint="Publishes this page at /p/… for visitors." checked={Boolean(editing.enabled)} onChange={(enabled) => setEditing({ ...editing, enabled })} />
              <Tick label="Add to the header menu" checked={Boolean(editing.showInNav)} onChange={(showInNav) => setEditing({ ...editing, showInNav })} />
              <Tick label="Add to the footer" checked={Boolean(editing.showInFooter)} onChange={(showInFooter) => setEditing({ ...editing, showInFooter })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white" onClick={save}>
                Save page
              </button>
              {editing.id && (
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                  onClick={() => {
                    if (!window.confirm("Delete this page?")) return;
                    deleteCmsPage(editing.id!);
                    setEditing(null);
                    setNote("Page deleted.");
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
            Choose a page from the list, or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}

function Tick({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-burgundy" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
