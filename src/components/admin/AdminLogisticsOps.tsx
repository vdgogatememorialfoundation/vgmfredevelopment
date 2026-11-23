"use client";

import { useEffect, useState } from "react";
import { Button, SelectInput, TextInput } from "@/components/admin/AdminUI";

type OpsTab = "shifts" | "pickup" | "hyperlocal" | "openbox";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AdminLogisticsOps() {
  const [tab, setTab] = useState<OpsTab>("shifts");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [allocHub, setAllocHub] = useState("");
  const [allocExec, setAllocExec] = useState("");

  const load = async () => {
    const r = await fetch("/api/admin/logistics-ops", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) {
      setData(j);
      if (!allocHub && j.hubs?.length) setAllocHub(j.hubs[0].code);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab") as OpsTab | null;
      if (t) setTab(t);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/logistics-ops", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Operation failed.");
      setMsg({ text: j.message || "Saved." });
      await load();
      return j;
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed.", err: true });
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="p-8 text-sm text-text-muted">Loading VGMF Shift, Pickup, Hyperlocal &amp; Open-Box Operations…</div>;

  const ob = data.openBoxSettings;

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">VGMF Shifts, Pickup Allocation, Hyperlocal &amp; Open-Box Ops</h1>
          <p className="text-xs text-text-muted">
            Configure executive shifts &amp; service modes (Normal / Hyperlocal / Both), customer delivery slots, automatic pickup manifests, and 3-layer Open-Box inspection.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>Refresh</Button>
      </div>

      {msg && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${msg.err ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["shifts", "Shift & Timeslot Management"],
            ["pickup", "Automatic Pickup Allocation"],
            ["hyperlocal", "Hyperlocal Operations"],
            ["openbox", "Open-Box Delivery & Inspections"],
          ] as const
        ).map(([id, lbl]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${tab === id ? "bg-burgundy text-white" : "border border-border bg-white text-text-primary hover:bg-warm-cream"}`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* 1. SHIFT & TIMESLOT MANAGEMENT */}
      {tab === "shifts" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold">Delivery Executive Service Modes (Normal Courier / Hyperlocal / Both)</h2>
            <p className="text-xs text-text-muted">Configure whether each delivery partner handles Normal Logistics, Hyperlocal, or Both.</p>
            <div className="space-y-2">
              {(data.agentEnrollments || []).length === 0 ? (
                <p className="text-xs text-text-muted">No delivery partners enrolled yet. Once partners sign up in the app, configure their service modes here.</p>
              ) : (
                (data.agentEnrollments || []).map((ag: { email: string; name: string; hubCode: string; status: string; serviceMode?: string }) => (
                  <div key={ag.email} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-xs">
                    <div>
                      <p className="font-bold">{ag.name} <span className="font-normal text-text-muted">({ag.email})</span></p>
                      <p className="text-text-muted">Hub: <b className="font-mono">{ag.hubCode}</b> · Status: <b>{ag.status}</b></p>
                    </div>
                    <SelectInput
                      className="w-56"
                      value={ag.serviceMode || "both"}
                      onChange={(e) => void act({ action: "set-service-mode", email: ag.email, serviceMode: e.target.value })}
                    >
                      <option value="both">Both (Normal + Hyperlocal)</option>
                      <option value="normal">Normal Logistics Only</option>
                      <option value="hyperlocal">Hyperlocal Only</option>
                    </SelectInput>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-extrabold">Executive Shift Templates</h2>
              {(data.shiftTemplates || []).map((sh: { id: string; name: string; startTime: string; endTime: string; purpose: string; maxParcelsPerExec: number }) => (
                <div key={sh.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs">
                  <div>
                    <p className="font-bold">{sh.name} ({sh.startTime} – {sh.endTime})</p>
                    <p className="text-text-muted">{sh.purpose}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-900">Max {sh.maxParcelsPerExec} parcels/exec</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-extrabold">Customer Delivery Slots &amp; Live Capacity</h2>
              {(data.deliverySlots || []).map((sl: { id: string; label: string; plannedCapacity: number; confirmedCount: number; reservedCount: number; hyperlocalEnabled: boolean; normalEnabled: boolean }) => {
                const used = sl.confirmedCount + sl.reservedCount;
                const rem = Math.max(0, sl.plannedCapacity - used);
                const pct = Math.min(100, Math.round((used / Math.max(1, sl.plannedCapacity)) * 100));
                return (
                  <div key={sl.id} className="rounded-lg border border-border p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{sl.label}</span>
                      <span className="font-mono font-bold text-blue-900">{used}/{sl.plannedCapacity} · {rem} remaining</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Hyperlocal: <b>{sl.hyperlocalEnabled ? "ON" : "OFF"}</b> · Normal Logistics: <b>{sl.normalEnabled ? "ON" : "OFF"}</b>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2">
            <h2 className="text-sm font-extrabold">Live Executive Shift Attendance ({data.attendance?.length || 0})</h2>
            {(data.attendance || []).map((att: { email: string; name: string; hubCode: string; shiftName: string; serviceMode: string; status: string; activeTasks: number; maxParcels: number }) => (
              <div key={att.email} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-xs">
                <span><b>{att.name}</b> ({att.hubCode}) · {att.shiftName} · Mode: <b>{att.serviceMode}</b></span>
                <span>Status: <b className="uppercase">{att.status.replace(/_/g, " ")}</b> · Load: <b>{att.activeTasks}/{att.maxParcels}</b></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. AUTOMATIC PICKUP ALLOCATION */}
      {tab === "pickup" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold">Automatic Seller Pickup Allocation Engine</h2>
            <p className="text-xs text-text-muted">Groups ready VGMF Booked shipments and automatically allocates them to a checked-in executive with remaining shift capacity.</p>
            <div className="flex flex-wrap gap-2">
              <SelectInput className="w-52" value={allocHub} onChange={(e) => setAllocHub(e.target.value)}>
                <option value="">All Hubs</option>
                {(data.hubs || []).map((h: { code: string; name: string }) => (
                  <option key={h.code} value={h.code}>{h.code} — {h.name}</option>
                ))}
              </SelectInput>
              <TextInput className="w-56" placeholder="Override Executive Email (optional)" value={allocExec} onChange={(e) => setAllocExec(e.target.value)} />
              <Button disabled={busy} onClick={() => void act({ action: "auto-allocate-pickup", hubCode: allocHub, executiveEmail: allocExec || undefined })}>
                Auto-Allocate Pickup Manifest
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {(data.pickupManifests || []).map((pm: { id: string; hubCode: string; executiveName: string; shiftWindow: string; expectedAwbs: string[]; scannedAwbs: string[]; status: string; autoAllocated: boolean }) => (
              <div key={pm.id} className="rounded-xl border border-border bg-white p-3.5 text-xs space-y-1.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold">{pm.id} <span className="font-sans text-xs font-normal text-text-muted">({pm.autoAllocated ? "Auto-allocated" : "Manual"})</span></span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-900">{pm.status} · {pm.scannedAwbs.length}/{pm.expectedAwbs.length} scanned</span>
                </div>
                <p className="text-text-muted">Executive: <b>{pm.executiveName}</b> · Hub {pm.hubCode} · Window: {pm.shiftWindow}</p>
                <p className="font-mono text-[11px] text-text-muted">AWBs: {pm.expectedAwbs.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. HYPERLOCAL OPERATIONS */}
      {tab === "hyperlocal" && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold">Hyperlocal Routing Mode</h2>
          <p className="text-xs text-text-muted">Choose whether hyperlocal orders route directly from Seller → Customer without forced hub stops, or via a local Micro-Hub.</p>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ["direct_seller_to_customer", "Direct Seller → Customer (No Hub Stop)"],
                ["micro_hub", "Seller → Local Micro-Hub → Customer"],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => void act({ action: "save-open-box-settings", openBoxSettings: { ...ob, hyperlocalRouteMode: val } })}
                className={`rounded-xl border px-4 py-3 text-xs font-bold ${ob.hyperlocalRouteMode === val ? "border-burgundy bg-burgundy text-white" : "border-border bg-white text-text-primary"}`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <p className="text-xs text-emerald-800 font-semibold">
            Active Hyperlocal-Eligible Executives: {(data.attendance || []).filter((a: { serviceMode: string; status: string }) => a.status === "checked_in" && (a.serviceMode === "hyperlocal" || a.serviceMode === "both")).length} checked in right now.
          </p>
        </div>
      )}

      {/* 4. OPEN-BOX DELIVERY & INSPECTION RECORDS */}
      {tab === "openbox" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-extrabold">Open-Box Delivery Rules (3-Layer Verification)</h2>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              {[
                ["enabled", "Enable Open-Box Delivery"],
                ["requireLast4Mobile", "Require Last 4 Digits of Registered Customer Mobile (Masked ******4067)"],
                ["requireSeparateOpenBoxOtp", "Use 2 Separate 6-Digit OTPs (Open-Box Auth OTP + Final Delivery OTP)"],
                ["requireInspectionPhotos", "Mandatory Camera Photos (Before Opening, After Opening, Product Condition)"],
                ["requireQuestionnaire", "Mandatory 5-Question Customer Inspection Questionnaire"],
                ["allowCustomerRefusal", "Allow Customer Refusal / Damage Exception Workflow"],
              ].map(([k, lbl]) => (
                <label key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 font-semibold">
                  <span>{lbl}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-burgundy"
                    checked={Boolean(ob[k])}
                    onChange={(e) => void act({ action: "save-open-box-settings", openBoxSettings: { ...ob, [k]: e.target.checked } })}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-extrabold">Open-Box Inspection Records &amp; Exceptions ({data.openBoxSessions?.length || 0})</h3>
            {(data.openBoxSessions || []).length === 0 ? (
              <p className="text-xs text-text-muted">No open-box inspection sessions recorded yet.</p>
            ) : (
              (data.openBoxSessions || []).map((s: { id: string; awb: string; orderId: string; executiveName: string; status: string; customerDecision?: string; exceptionCaseId?: string; last4Verified: boolean; openBoxOtpVerified: boolean; finalDeliveryOtpVerified: boolean }) => (
                <div key={s.id} className="rounded-xl border border-border p-3 text-xs space-y-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono font-bold">{s.id} · AWB {s.awb} (#{s.orderId})</span>
                    <span className={`rounded-full px-2.5 py-0.5 font-bold ${s.status === "Delivered" ? "bg-emerald-100 text-emerald-900" : s.status === "Exception" ? "bg-red-100 text-red-900" : "bg-blue-100 text-blue-900"}`}>{s.status}</span>
                  </div>
                  <p className="text-text-muted">
                    Exec: {s.executiveName} · Last-4: {s.last4Verified ? "✓" : "—"} · Open-Box OTP: {s.openBoxOtpVerified ? "✓" : "—"} · Final OTP: {s.finalDeliveryOtpVerified ? "✓" : "—"}
                    {s.customerDecision ? ` · Decision: ${s.customerDecision.toUpperCase()}` : ""}
                    {s.exceptionCaseId ? ` · Exception: ${s.exceptionCaseId}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
