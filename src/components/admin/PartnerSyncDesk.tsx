"use client";

import { useEffect, useState } from "react";
import { hydratePartnerFeed, syncPartnerPortalsNow } from "@/lib/partner-hydrate";

type Stats = {
  events: number;
  notices: number;
  accounts: number;
  tickets: number;
  payments: number;
  source: string;
};

export function PartnerSyncDesk() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [syncedAt, setSyncedAt] = useState("");
  const [stats, setStats] = useState<Record<string, Stats> | null>(null);

  const load = () => {
    fetch("/api/partners/feed", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((data: { syncedAt?: string; stats?: Record<string, Stats> }) => {
        setSyncedAt(data.syncedAt ?? "");
        setStats(data.stats ?? null);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    void hydratePartnerFeed({ full: true });
  }, []);

  const sync = async () => {
    setBusy(true);
    setNote("");
    try {
      const result = await syncPartnerPortalsNow();
      setSyncedAt(result.syncedAt ?? "");
      setStats((result.stats as Record<string, Stats>) ?? null);
      setNote(
        `Synced ${result.events ?? 0} events, ${result.notices ?? 0} notices and ${result.accounts ?? 0} accounts from the Seminar and Autism portals.`
      );
      load();
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sister portals</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Seminar and Autism events, notices, doctor accounts, applicants, e-tickets and payments are copied here. QR codes stay on those portals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sync()}
          disabled={busy}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {syncedAt ? (
        <p className="text-xs text-slate-500">
          Last sync {new Date(syncedAt).toLocaleString("en-IN", { timeZone: "Asia/Calcutta" })} IST
        </p>
      ) : (
        <p className="text-xs text-slate-500">No sister-portal copy yet. Use Sync now.</p>
      )}
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(stats).map(([id, row]) => (
            <section key={id} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold capitalize text-slate-900">{id === "seminar" ? "Seminar Portal" : "Autism Portal"}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-slate-500">Events</dt><dd className="font-semibold">{row.events}</dd></div>
                <div><dt className="text-slate-500">Notices</dt><dd className="font-semibold">{row.notices}</dd></div>
                <div><dt className="text-slate-500">Accounts</dt><dd className="font-semibold">{row.accounts}</dd></div>
                <div><dt className="text-slate-500">E-tickets</dt><dd className="font-semibold">{row.tickets}</dd></div>
                <div><dt className="text-slate-500">Payments</dt><dd className="font-semibold">{row.payments}</dd></div>
                <div><dt className="text-slate-500">Source</dt><dd className="font-semibold capitalize">{row.source.replace("-", " ")}</dd></div>
              </dl>
            </section>
          ))}
        </div>
      ) : null}
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}
    </div>
  );
}
