"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/utils";

type Row = {
  id: string;
  at: string;
  actor: string;
  actorType: "staff" | "customer" | "guest";
  role?: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
};

export function AuditLogDesk() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (query: string, kind: string) => {
    try {
      const params = new URLSearchParams({ q: query, type: kind, limit: "1000" });
      const response = await fetch(`/api/audit?${params}`, { credentials: "same-origin", cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; rows?: Row[]; error?: string };
      if (!data.ok) throw new Error(data.error || "Could not load the activity log.");
      setRows(data.rows ?? []);
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load the activity log.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(q, type), 250);
    return () => window.clearTimeout(timer);
  }, [q, type, load]);

  return (
    <Panel title="Activity log" description="Every recorded action by staff and customers: shipments created, order status changes, sign-ins, account changes and more.">
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search person, order ID, action…"
          className="min-w-64 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
        />
        <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="">Staff and customers</option>
          <option value="staff">Staff only</option>
          <option value="customer">Customers only</option>
          <option value="guest">Guests</option>
        </select>
        <button type="button" onClick={() => void load(q, type)} className="btn-outline px-3 py-2 text-sm">Refresh</button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-text-muted">
            <tr>
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Who</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">On</th>
              <th className="py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap py-2 pr-3 text-xs text-text-muted">{formatDateTime(row.at)}</td>
                <td className="py-2 pr-3">
                  <span className="font-medium text-text-primary">{row.actor}</span>
                  <span className="block text-xs text-text-muted">{row.actorType}{row.role ? ` · ${row.role}` : ""}</span>
                </td>
                <td className="py-2 pr-3 font-semibold text-text-primary">{row.action}</td>
                <td className="py-2 pr-3 font-mono text-xs">{row.target}</td>
                <td className="py-2 text-xs text-text-muted">{row.detail}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-text-muted">No activity recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
