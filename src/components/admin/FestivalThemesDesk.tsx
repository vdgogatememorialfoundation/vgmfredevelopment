"use client";

import { useState } from "react";
import { publishLiveSite } from "@/lib/mobile-publish";
import { activeFestival, festivalPresets, indiaToday, type FestivalSchedule } from "@/lib/festival-themes";
import { defaultSiteTheme, getSiteText, saveSiteText } from "@/lib/site-text";

function fixedDates(start: string, end: string) {
  const year = Number(indiaToday().slice(0, 4));
  const from = `${year}-${start}`;
  const to = `${end < start ? year + 1 : year}-${end}`;
  return to < indiaToday() ? { start: `${year + 1}-${start}`, end: `${end < start ? year + 2 : year + 1}-${end}` } : { start: from, end: to };
}

export function FestivalThemesDesk() {
  const [rows, setRows] = useState<Record<string, FestivalSchedule>>(() =>
    Object.fromEntries((getSiteText().festivals ?? []).map((row) => [row.id, row]))
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const today = indiaToday();
  const list = festivalPresets.map((preset) => rows[preset.id] ?? { id: preset.id, enabled: false });
  const running = activeFestival(list, today);

  function update(id: string, patch: Partial<FestivalSchedule>) {
    setRows((current) => ({ ...current, [id]: { ...(current[id] ?? { id, enabled: false }), ...patch } }));
  }

  function save() {
    setBusy(true);
    const festivals = list.filter((row) => row.enabled || row.start || row.end || row.greeting);
    saveSiteText({ ...getSiteText(), festivals });
    void publishLiveSite().then((result) => {
      setBusy(false);
      setNote(
        result.ok
          ? "Saved and published. The website switches on each festival's dates and goes back afterwards."
          : "Saved in this browser. Publishing did not complete; it will retry on the next save."
      );
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">Festival themes</h1>
        <p className="mt-1 text-sm text-text-muted">
          Switch a festival on and set its dates. On those dates (India time) the public website takes the festival
          colours and shows a greeting strip at the top, then returns to the normal colours. A festival switched on
          with no dates runs straight away. If two overlap, the one higher in this list wins. Admin, staff and support
          pages keep their normal colours.
        </p>
        <p className="mt-2 text-sm font-semibold text-ink">
          Running today: {running ? `${running.preset.label} — ${running.greeting}` : "none (normal colours)"}
        </p>
      </div>

      <div className="space-y-3">
        {festivalPresets.map((preset) => {
          const row = rows[preset.id] ?? { id: preset.id, enabled: false };
          const colors = { ...defaultSiteTheme, ...preset.colors };
          return (
            <section key={preset.id} className="rounded-xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      const dates = enabled && !row.start && !row.end && preset.fixed
                        ? fixedDates(preset.fixed.start, preset.fixed.end)
                        : {};
                      update(preset.id, { enabled, ...dates });
                    }}
                  />
                  {preset.label}
                </label>
                <span aria-hidden className="text-base">{preset.decor}</span>
                <span className="flex gap-1" aria-hidden>
                  {[colors.burgundy, colors.gold, colors.saffron, colors.ink].map((color, index) => (
                    <span key={index} className="h-4 w-4 rounded-full border border-border" style={{ background: color }} />
                  ))}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-text-muted">
                  Starts
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm text-ink"
                    value={row.start ?? ""}
                    onChange={(event) => update(preset.id, { start: event.target.value || undefined })}
                  />
                </label>
                <label className="text-xs text-text-muted">
                  Ends
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm text-ink"
                    value={row.end ?? ""}
                    onChange={(event) => update(preset.id, { end: event.target.value || undefined })}
                  />
                </label>
                <label className="text-xs text-text-muted">
                  Greeting
                  <input
                    className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm text-ink"
                    placeholder={preset.greeting}
                    value={row.greeting ?? ""}
                    onChange={(event) => update(preset.id, { greeting: event.target.value || undefined })}
                  />
                </label>
              </div>
              {!preset.fixed ? (
                <p className="mt-2 text-xs text-text-muted">The date changes every year; set it from the panchang.</p>
              ) : null}
            </section>
          );
        })}
      </div>

      <button
        type="button"
        className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={busy}
        onClick={save}
      >
        {busy ? "Saving…" : "Save festival themes"}
      </button>
      {note ? <p className="text-sm text-text-muted">{note}</p> : null}
    </div>
  );
}
