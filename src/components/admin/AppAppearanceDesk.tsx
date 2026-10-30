"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  getAppearanceDraft,
  getPublishedAppearance,
  HOME_SECTION_IDS,
  publishAppearanceDraft,
  restoreAppearanceDefaults,
  saveAppearanceDraft,
  sanitizeAppearance,
  type AppearanceColors,
  type HomeSectionConfig,
  type MobileAppearance,
} from "@/lib/mobile-appearance";
import { collectMobileSnapshot } from "@/lib/mobile-publish";
import { canOpen } from "@/lib/roles";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const primary = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";
const tabs = ["Colors", "Home layout", "Type & cards", "Preview"] as const;

const COLOR_FIELDS: { key: keyof AppearanceColors; label: string }[] = [
  { key: "primary", label: "Primary (buttons)" },
  { key: "onPrimary", label: "Text on primary" },
  { key: "secondary", label: "Navy text" },
  { key: "accent", label: "Gold accent" },
  { key: "background", label: "Background" },
  { key: "surface", label: "Card surface" },
  { key: "paper", label: "Paper / white" },
  { key: "text", label: "Body text" },
  { key: "muted", label: "Muted text" },
  { key: "border", label: "Borders" },
];

export function AppAppearanceDesk() {
  const { user } = useAuth();
  const allowed = canOpen(user, "/admin/settings/appearance");
  const [draft, setDraft] = useState<MobileAppearance>(() => getAppearanceDraft());
  const [published, setPublished] = useState<MobileAppearance>(() => getPublishedAppearance());
  const [tab, setTab] = useState<(typeof tabs)[number]>("Colors");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const dirty = useMemo(() => JSON.stringify(sanitizeAppearance(draft)) !== JSON.stringify(published), [draft, published]);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">App appearance</h1>
        <p className="mt-2 text-sm text-slate-500">You do not have permission to edit the mobile theme.</p>
      </div>
    );
  }

  const patch = (next: Partial<MobileAppearance>) => setDraft((current) => sanitizeAppearance({ ...current, ...next }));
  const patchColor = (key: keyof AppearanceColors, value: string) =>
    setDraft((current) => sanitizeAppearance({ ...current, colors: { ...current.colors, [key]: value } }));

  const saveDraft = () => {
    try {
      saveAppearanceDraft(draft);
      setError("");
      setNote("Draft saved on this browser. The live app is unchanged until you Publish.");
    } catch {
      setError("Could not save the draft in this browser.");
    }
  };

  const publish = async () => {
    setBusy(true);
    setError("");
    setNote("Publishing appearance to the app…");
    try {
      const next = publishAppearanceDraft(draft);
      setDraft(next);
      setPublished(next);
      const snapshot = collectMobileSnapshot();
      const response = await fetch("/api/mobile/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...snapshot, appearance: next }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; publishedAt?: string };
      if (!data.ok) {
        setError(data.error || "Publish failed. The draft is stored on this browser.");
        return;
      }
      setNote(
        `Published ${new Date(next.publishedAt).toLocaleString("en-IN")}. Installed apps pick this up on the next refresh — no Play Store update.`
      );
    } catch (err) {
      setError((err as Error).message || "Publish failed.");
    } finally {
      setBusy(false);
    }
  };

  const restore = () => {
    if (!window.confirm("Restore the default VGMF light theme in the draft? Published apps stay as they are until you Publish.")) return;
    const next = restoreAppearanceDefaults();
    setDraft(next);
    setNote("Draft restored to defaults. Publish to push this to phones.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">App appearance</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Change colors, home sections and labels for all four Expo apps. Save a draft while you work. Publish when the
            live apps should pick it up. This does not execute code on the phone — only approved theme tokens.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghost} onClick={saveDraft}>
            Save draft
          </button>
          <button type="button" className={ghost} onClick={restore}>
            Restore defaults
          </button>
          <button type="button" className={primary} disabled={busy} onClick={() => void publish()}>
            {busy ? "Publishing…" : "Publish to app"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatusCard label="Draft" value={dirty ? "Unpublished changes" : "Matches live"} />
        <StatusCard label="Live version" value={published.version ? `v${published.version}` : "Defaults"} />
        <StatusCard
          label="Last published"
          value={published.publishedAt ? new Date(published.publishedAt).toLocaleString("en-IN") : "Not published yet"}
        />
      </div>

      {note ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{note}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === item ? "bg-burgundy text-white" : "border border-slate-200 bg-white text-slate-600"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Colors" ? (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          {COLOR_FIELDS.map((field) => (
            <label key={field.key} className="text-sm font-medium text-slate-700">
              {field.label}
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={draft.colors[field.key]}
                  onChange={(event) => patchColor(field.key, event.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-white"
                />
                <input
                  className={input}
                  value={draft.colors[field.key]}
                  onChange={(event) => patchColor(field.key, event.target.value)}
                />
              </span>
            </label>
          ))}
        </section>
      ) : null}

      {tab === "Home layout" ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Hidden sections stay off the homepage. Empty published lists are also hidden in the app, even if a section is
            enabled here.
          </p>
          {draft.homeSections.map((section, index) => (
            <div key={section.id} className="grid gap-3 rounded-lg border border-slate-100 p-4 md:grid-cols-[auto_1fr_1fr_auto]">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={section.visible}
                  onChange={(event) => patch({ homeSections: editSection(draft.homeSections, section.id, { visible: event.target.checked }) })}
                />
                {HOME_SECTION_IDS.includes(section.id) ? section.id : section.id}
              </label>
              <input
                className={input}
                placeholder="Section title"
                value={section.title}
                onChange={(event) => patch({ homeSections: editSection(draft.homeSections, section.id, { title: event.target.value }) })}
              />
              <input
                className={input}
                placeholder="Supporting text (optional)"
                value={section.subtitle}
                onChange={(event) => patch({ homeSections: editSection(draft.homeSections, section.id, { subtitle: event.target.value }) })}
              />
              <div className="flex gap-2">
                <button type="button" className={ghost} onClick={() => patch({ homeSections: move(draft.homeSections, index, -1) })}>
                  Up
                </button>
                <button type="button" className={ghost} onClick={() => patch({ homeSections: move(draft.homeSections, index, 1) })}>
                  Down
                </button>
              </div>
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(draft.labels) as (keyof MobileAppearance["labels"])[]).map((key) => (
              <label key={key} className="text-sm font-medium text-slate-700">
                {key}
                <input className={`${input} mt-1`} value={draft.labels[key]} onChange={(event) => patch({ labels: { ...draft.labels, [key]: event.target.value } })} />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "Type & cards" ? (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Font
            <select className={`${input} mt-1`} value={draft.fontFamily} onChange={(event) => patch({ fontFamily: event.target.value === "serif" ? "serif" : "system" })}>
              <option value="system">System (installed)</option>
              <option value="serif">Serif (installed)</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Card corners
            <select className={`${input} mt-1`} value={draft.radiusPreset} onChange={(event) => patch({ radiusPreset: event.target.value as MobileAppearance["radiusPreset"] })}>
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="soft">Soft</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Spacing
            <select className={`${input} mt-1`} value={draft.spacingPreset} onChange={(event) => patch({ spacingPreset: event.target.value as MobileAppearance["spacingPreset"] })}>
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="relaxed">Relaxed</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Product grid
            <select className={`${input} mt-1`} value={draft.productColumns} onChange={(event) => patch({ productColumns: Number(event.target.value) === 1 ? 1 : 2 })}>
              <option value={2}>Two columns</option>
              <option value={1}>One column</option>
            </select>
          </label>
          <p className="sm:col-span-2 text-sm text-slate-500">Carousel images stay square (1:1). Title {draft.typeScale.title}px · body {draft.typeScale.body}px.</p>
          {(["title", "heading", "body", "caption"] as const).map((key) => (
            <label key={key} className="text-sm font-medium text-slate-700">
              {key} size
              <input
                type="number"
                className={`${input} mt-1`}
                value={draft.typeScale[key]}
                onChange={(event) => patch({ typeScale: { ...draft.typeScale, [key]: Number(event.target.value) } })}
              />
            </label>
          ))}
        </section>
      ) : null}

      {tab === "Preview" ? <PhonePreview draft={draft} /> : null}
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function editSection(list: HomeSectionConfig[], id: string, patch: Partial<HomeSectionConfig>) {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function move<T>(list: T[], index: number, delta: number) {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function PhonePreview({ draft }: { draft: MobileAppearance }) {
  const c = draft.colors;
  return (
    <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-6">
      <div className="w-[320px] overflow-hidden rounded-[28px] border-8 border-slate-900 shadow-xl" style={{ background: c.background, color: c.text, fontFamily: draft.fontFamily === "serif" ? "Georgia, serif" : "system-ui, sans-serif" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: c.paper, borderBottom: `1px solid ${c.border}` }}>
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em]" style={{ color: c.accent }}>VAIDYA GOGATE</p>
            <p className="text-sm font-bold" style={{ color: c.secondary }}>VGMF</p>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: c.primary, border: `1px solid ${c.accent}` }}>
            {draft.labels.bag} 0
          </span>
        </div>
        <div className="px-4 py-3">
          <div className="rounded-full px-3 py-2 text-xs" style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.muted }}>
            {draft.labels.searchPlaceholder}
          </div>
          <div className="mx-auto mt-3 aspect-square w-full rounded-2xl" style={{ background: c.surface, border: `1px solid ${c.border}` }} />
          <p className="mt-3 text-xs font-bold" style={{ color: c.secondary }}>
            {draft.homeSections.find((item) => item.id === "shop")?.title || draft.labels.shop}
          </p>
          <div className={`mt-2 grid gap-2 ${draft.productColumns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {["Ayurveda texts", "Clinical notes"].map((title) => (
              <div key={title} className="p-2" style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: draft.radiusPreset === "soft" ? 18 : 12 }}>
                <div className="aspect-square rounded-lg" style={{ background: c.background }} />
                <p className="mt-2 text-[11px] font-semibold">{title}</p>
                <p className="text-[11px] font-bold" style={{ color: c.primary }}>₹499</p>
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 w-full py-2 text-xs font-bold" style={{ background: c.primary, color: c.onPrimary, borderRadius: 12 }}>
            Send code
          </button>
        </div>
      </div>
    </div>
  );
}
