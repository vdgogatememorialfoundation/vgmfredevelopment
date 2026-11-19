"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";

export type LoggedEmailRow = { id?: string; at: string; to: string; subject: string; ok: boolean; error?: string; refs?: string[]; resendable?: boolean };

/** Resends a logged email exactly as it went out, to the same or another address. */
export function ResendEmailButton({ id, to, onSent }: { id?: string; to: string; onSent?: () => void }) {
  const [state, setState] = useState<"" | "busy" | "sent" | string>("");
  if (!id) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={state === "busy"}
        className="rounded border border-border px-2 py-0.5 text-[11px] font-semibold text-primary disabled:opacity-60"
        onClick={async () => {
          const target = window.prompt("Resend this email to:", to);
          if (target === null) return;
          setState("busy");
          const response = await fetch("/api/admin/emails", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id, to: target.trim() || to }),
          }).catch(() => null);
          const body = (await response?.json().catch(() => null)) as { ok?: boolean; error?: string; to?: string } | null;
          setState(body?.ok ? "sent" : body?.error || "Could not send.");
          if (body?.ok) onSent?.();
        }}
      >
        {state === "busy" ? "Sending…" : "Resend"}
      </button>
      {state === "sent" && <span className="text-[11px] text-green-700">Sent</span>}
      {state && state !== "busy" && state !== "sent" && <span className="text-[11px] text-red-600">{state}</span>}
    </span>
  );
}

/** Every email the server sent: account, orders, events, refunds. Search and resend any of them. */
export function EmailLogDesk() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<LoggedEmailRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/emails?q=${encodeURIComponent(query)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (!live) return;
        if (body?.ok) {
          setRows(body.emails ?? []);
          setError("");
        } else setError(body?.error || "Could not load the emails.");
      })
      .catch(() => live && setError("Could not reach the server."));
    return () => {
      live = false;
    };
  }, [query, tick]);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Email log &amp; resend</p>
          <p className="text-xs text-slate-500">Every email the server sends (account, sign-in, orders, events, refunds). Resend any one exactly as it went out.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(q);
          }}
        >
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Email, subject or order id" className="w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium">Search</button>
          <button type="button" onClick={() => setTick((value) => value + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Refresh</button>
        </form>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {!rows && !error && <p className="mt-2 text-xs text-slate-500">Loading…</p>}
      {rows && rows.length === 0 && <p className="mt-2 text-xs text-slate-500">No emails found.</p>}
      {rows && rows.length > 0 && (
        <ol className="mt-3 max-h-[32rem] space-y-1.5 overflow-auto text-xs">
          {rows.map((row, index) => (
            <li key={row.id ?? index} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 pb-1.5">
              <span className="w-36 shrink-0 text-slate-500">{formatDateTime(row.at)}</span>
              <span className="min-w-0 flex-1">
                <b>{row.subject}</b> · {row.to}{" "}
                {row.ok ? <span className="text-green-700">· Sent</span> : <span className="text-red-600">· Not sent{row.error ? `: ${row.error}` : ""}</span>}
              </span>
              {row.resendable ? <ResendEmailButton id={row.id} to={row.to} onSent={() => setTick((value) => value + 1)} /> : <span className="text-[11px] text-slate-400">older, can&apos;t resend</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
