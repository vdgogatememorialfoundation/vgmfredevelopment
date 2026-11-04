"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  number: string;
  name: string;
  kind: "participant" | "volunteer";
  event: string;
  eventDate: string;
  enabled: boolean;
  scanVerified: boolean;
  updatedAt: string;
};

type Filter = "all" | "enabled" | "disabled";

export function SeminarCertificates() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [kind, setKind] = useState<"all" | Row["kind"]>("all");

  useEffect(() => {
    let live = true;
    fetch("/api/admin/seminar-certificates", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((data: { ok?: boolean; certificates?: Row[]; error?: string }) => {
        if (!live) return;
        if (data.ok && Array.isArray(data.certificates)) setRows(data.certificates);
        else setError(data.error || "Could not load seminar certificates.");
      })
      .catch(() => live && setError("Could not reach the server."));
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return (rows ?? []).filter((row) => {
      if (filter === "enabled" && !row.enabled) return false;
      if (filter === "disabled" && row.enabled) return false;
      if (kind !== "all" && row.kind !== kind) return false;
      if (!needle) return true;
      return (
        (digits.length >= 4 && row.number.includes(digits)) ||
        row.name.toLowerCase().includes(needle) ||
        row.event.toLowerCase().includes(needle)
      );
    });
  }, [rows, query, filter, kind]);

  const enabledCount = rows?.filter((row) => row.enabled).length ?? 0;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-blue-950">Seminar certificates</h2>
          <p className="text-sm text-slate-600">
            Read live from the seminar portal. Only enabled certificates verify on the public page.
            {rows ? ` ${rows.length} certificates · ${enabledCount} enabled.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Certificate no., name or event"
            className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
            <option value="all">All statuses</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Not enabled</option>
          </select>
          <select value={kind} onChange={(event) => setKind(event.target.value as "all" | Row["kind"])} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
            <option value="all">Participant + volunteer</option>
            <option value="participant">Participant</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </div>
      </div>
      {error ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p> : null}
      {!rows && !error ? <p className="mt-4 text-sm text-slate-500">Loading seminar certificates…</p> : null}
      {rows ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Certificate no.</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 500).map((row) => (
                <tr key={`${row.kind}-${row.number}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-blue-900">{row.number}</td>
                  <td className="px-3 py-2 text-slate-800">{row.name || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{row.kind === "volunteer" ? "Volunteer" : "Participant"}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.event || "—"}
                    {row.eventDate ? <span className="text-slate-400"> · {row.eventDate}</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {row.enabled ? "Enabled · verifies" : "Not enabled"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length ? <p className="px-3 py-4 text-sm text-slate-500">No certificates match.</p> : null}
          {shown.length > 500 ? <p className="px-3 py-2 text-xs text-slate-500">Showing 500 of {shown.length}. Narrow the search to see more.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
