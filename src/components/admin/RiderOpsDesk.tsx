"use client";

import { useCallback, useEffect, useState } from "react";

type Handover = { id: string; name: string; email: string; bookingId: string; hubCode: string; expected: number; declared: number; difference: number; note?: string; status: string; submittedAt: string; verifiedBy?: string };
type Settings = { rates: Record<string, number>; surge: Record<string, number>; openBoxThreshold: number; checkInGraceMinutes: number; failReasons: string[] };
type Wallet = { balance: number; today: number; week: number; paidOut: number; transactions: { id: string; at: string; type: string; amount: number; note: string }[] };

const inr = (n: number) => `₹${Math.round(Number(n || 0) * 100) / 100}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function RiderOpsDesk() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [walletEmail, setWalletEmail] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [payout, setPayout] = useState({ type: "payout", amount: "", note: "" });
  const [msg, setMsg] = useState("");
  const [surgeText, setSurgeText] = useState("");
  const [reasonsText, setReasonsText] = useState("");

  const load = useCallback(async (email = "") => {
    const res = await fetch(`/api/admin/rider-ops${email ? `?wallet=${encodeURIComponent(email)}` : ""}`, { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) return setMsg(data.error || "Could not load.");
    setSettings(data.settings);
    setHandovers(data.handovers);
    setWallet(data.wallet);
    setSurgeText(Object.entries(data.settings.surge as Record<string, number>).map(([id, m]) => `${id}=${m}`).join(", "));
    setReasonsText((data.settings.failReasons as string[]).join("\n"));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const post = async (body: Record<string, unknown>, done: string) => {
    const res = await fetch("/api/admin/rider-ops", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setMsg(data.ok ? done : data.error || "Failed.");
    if (data.ok) await load(walletEmail);
  };

  const saveSettings = () => {
    if (!settings) return;
    const surge = Object.fromEntries(
      surgeText.split(",").map((part) => part.split("=").map((s) => s.trim())).filter(([id, m]) => id && Number(m) > 0).map(([id, m]) => [id, Number(m)])
    );
    void post({ action: "settings", settings: { ...settings, surge, failReasons: reasonsText.split("\n").map((s) => s.trim()).filter(Boolean) } }, "Settings saved.");
  };

  const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";
  const input = "rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riders: shifts, cash &amp; wallet</h1>
        <p className="text-sm text-gray-500">Delivery app (courier and hyperlocal riders). Activate riders under Delivery Partner Accounts / hub enrolment.</p>
        {msg ? <p className="mt-2 text-sm font-semibold text-burgundy">{msg}</p> : null}
      </div>

      <section className={card}>
        <h2 className="mb-3 text-lg font-bold text-gray-900">End-of-shift cash handovers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500">
              <tr><th className="py-2">Handover</th><th>Rider</th><th>Shift</th><th>Hub</th><th>Collected</th><th>Handed over</th><th>Difference</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {handovers.length ? null : <tr><td colSpan={9} className="py-4 text-gray-500">No handovers yet.</td></tr>}
              {handovers.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="py-2 font-mono text-xs">{h.id}<div className="text-gray-400">{when(h.submittedAt)}</div></td>
                  <td>{h.name}<div className="text-xs text-gray-400">{h.email}</div></td>
                  <td className="font-mono text-xs">{h.bookingId}</td>
                  <td>{h.hubCode || "—"}</td>
                  <td>{inr(h.expected)}</td>
                  <td>{inr(h.declared)}</td>
                  <td className={h.difference === 0 ? "text-green-700" : "text-red-700"}>{h.difference === 0 ? "Matches" : inr(h.difference)}{h.note ? <div className="text-xs text-gray-500">{h.note}</div> : null}</td>
                  <td>{h.status}{h.verifiedBy ? <div className="text-xs text-gray-400">{h.verifiedBy}</div> : null}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    {h.status === "submitted" ? (
                      <>
                        <button className="rounded-lg bg-green-700 px-3 py-1 text-xs font-bold text-white" onClick={() => void post({ action: "verify-handover", id: h.id, ok: true }, "Handover verified.")}>Verify</button>
                        <button className="rounded-lg border border-red-300 px-3 py-1 text-xs font-bold text-red-700" onClick={() => void post({ action: "verify-handover", id: h.id, ok: false }, "Marked disputed.")}>Dispute</button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-lg font-bold text-gray-900">Rider wallet &amp; payouts</h2>
        <div className="flex flex-wrap gap-2">
          <input className={`${input} w-72`} placeholder="Rider email" value={walletEmail} onChange={(e) => setWalletEmail(e.target.value)} />
          <button className="rounded-lg bg-burgundy px-4 py-2 text-sm font-bold text-white" onClick={() => void load(walletEmail.trim())}>Open wallet</button>
        </div>
        {wallet ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <span>Balance <b>{inr(wallet.balance)}</b></span>
              <span>Today <b>{inr(wallet.today)}</b></span>
              <span>7 days <b>{inr(wallet.week)}</b></span>
              <span>Paid out <b>{inr(wallet.paidOut)}</b></span>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className={input} value={payout.type} onChange={(e) => setPayout({ ...payout, type: e.target.value })}>
                <option value="payout">Payout (debit)</option>
                <option value="incentive">Incentive (credit)</option>
                <option value="adjustment">Adjustment (+/−)</option>
              </select>
              <input className={`${input} w-32`} placeholder="Amount" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} />
              <input className={`${input} w-72`} placeholder="Note / UTR" value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} />
              <button className="rounded-lg bg-burgundy px-4 py-2 text-sm font-bold text-white" onClick={() => void post({ action: "wallet-entry", email: walletEmail.trim(), ...payout, amount: Number(payout.amount) }, "Wallet updated.")}>Add</button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {wallet.transactions.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="py-1 text-gray-500">{when(t.at)}</td>
                    <td>{t.note}</td>
                    <td className="text-xs uppercase text-gray-400">{t.type}</td>
                    <td className={`text-right font-semibold ${t.amount < 0 ? "text-red-700" : "text-green-700"}`}>{inr(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {settings ? (
        <section className={card}>
          <h2 className="mb-3 text-lg font-bold text-gray-900">Rates, surge &amp; rules</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(settings.rates).map(([kind, rate]) => (
              <label key={kind} className="text-sm">
                <span className="block text-xs font-semibold uppercase text-gray-500">{kind === "obd" ? "Open-box delivery" : kind} (₹ per job)</span>
                <input className={`${input} w-full`} value={rate} onChange={(e) => setSettings({ ...settings, rates: { ...settings.rates, [kind]: Number(e.target.value) || 0 } })} />
              </label>
            ))}
            <label className="text-sm">
              <span className="block text-xs font-semibold uppercase text-gray-500">Open-box above order value (₹)</span>
              <input className={`${input} w-full`} value={settings.openBoxThreshold} onChange={(e) => setSettings({ ...settings, openBoxThreshold: Number(e.target.value) || 0 })} />
            </label>
            <label className="text-sm">
              <span className="block text-xs font-semibold uppercase text-gray-500">Early check-in allowed (minutes)</span>
              <input className={`${input} w-full`} value={settings.checkInGraceMinutes} onChange={(e) => setSettings({ ...settings, checkInGraceMinutes: Number(e.target.value) || 0 })} />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="block text-xs font-semibold uppercase text-gray-500">Surge per shift (shiftId=multiplier, comma separated, e.g. evening=1.5)</span>
            <input className={`${input} w-full`} value={surgeText} onChange={(e) => setSurgeText(e.target.value)} />
          </label>
          <label className="mt-3 block text-sm">
            <span className="block text-xs font-semibold uppercase text-gray-500">Reject / failed reasons (one per line)</span>
            <textarea className={`${input} h-40 w-full`} value={reasonsText} onChange={(e) => setReasonsText(e.target.value)} />
          </label>
          <button className="mt-3 rounded-lg bg-burgundy px-4 py-2 text-sm font-bold text-white" onClick={saveSettings}>Save</button>
        </section>
      ) : null}
    </div>
  );
}
