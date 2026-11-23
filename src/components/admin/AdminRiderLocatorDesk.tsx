"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, SelectInput, TextInput } from "@/components/admin/AdminUI";

type RiderLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  at: string;
  note?: string;
};

type AgentEnrollment = {
  email: string;
  name: string;
  phone?: string;
  vehicleNo?: string;
  hubCode?: string;
  status: "unassigned" | "pending" | "approved" | "rejected";
  requestedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  lastLocation?: RiderLocation;
  kyc?: {
    provider?: string;
    status?: string;
    documentType?: string;
    documentNumber?: string;
    faceMatchScore?: number;
    livenessScore?: number;
    updatedAt?: string;
  };
};

type HubInfo = {
  code: string;
  name: string;
  city?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

type ActiveShipment = {
  shipmentId: string;
  awb: string;
  orderId: string;
  status: string;
  customerName: string;
  city: string;
  assignedAgentEmail?: string;
  agentName?: string;
  runsheetId?: string;
};

export default function AdminRiderLocatorDesk() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending" | "located">("all");
  const [selectedEmail, setSelectedEmail] = useState<string>("");
  const [hubMap, setHubMap] = useState<Record<string, string>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch("/api/admin/hub-ops", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) {
        setData(j);
        if (!selectedEmail && Array.isArray(j.agentEnrollments) && j.agentEnrollments.length > 0) {
          setSelectedEmail(j.agentEnrollments[0].email);
        }
      }
    } catch {
      if (!silent) setMsg({ text: "Failed to load riders.", err: true });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedEmail]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/hub-ops", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Action failed.");
      setMsg({ text: j.message || "Updated successfully." });
      await load(true);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed.", err: true });
    } finally {
      setBusy(false);
    }
  };

  const hubs: HubInfo[] = data?.hubs || [];
  const agents: AgentEnrollment[] = data?.agentEnrollments || [];
  const shipments: ActiveShipment[] = data?.activeShipments || [];

  const getCoordsForRider = (ag: AgentEnrollment) => {
    if (ag.lastLocation?.lat && ag.lastLocation?.lng) {
      return { lat: ag.lastLocation.lat, lng: ag.lastLocation.lng, source: "Live GPS", at: ag.lastLocation.at };
    }
    const hub = hubs.find((h) => h.code === ag.hubCode);
    if (hub?.lat && hub?.lng) {
      return { lat: hub.lat, lng: hub.lng, source: `Hub (${hub.code})`, at: ag.reviewedAt || ag.requestedAt };
    }
    return null;
  };

  const filtered = agents.filter((ag) => {
    if (statusFilter === "approved" && ag.status !== "approved") return false;
    if (statusFilter === "pending" && ag.status !== "pending" && ag.status !== "unassigned") return false;
    if (statusFilter === "located" && !getCoordsForRider(ag)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        ag.name.toLowerCase().includes(q) ||
        ag.email.toLowerCase().includes(q) ||
        (ag.phone || "").toLowerCase().includes(q) ||
        (ag.hubCode || "").toLowerCase().includes(q) ||
        (ag.vehicleNo || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedRider = agents.find((a) => a.email === selectedEmail) || filtered[0] || null;
  const selectedCoords = selectedRider ? getCoordsForRider(selectedRider) : null;
  const selectedHub = selectedRider ? hubs.find((h) => h.code === selectedRider.hubCode) : null;

  const activeCount = agents.filter((a) => a.status === "approved").length;
  const pendingCount = agents.filter((a) => a.status === "pending" || a.status === "unassigned").length;
  const gpsLiveCount = agents.filter((a) => Boolean(a.lastLocation?.lat)).length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">Locate Riders &amp; Partner Accounts</h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Live rider GPS locator, hub assignments, AccuraScan AI KYC review, and instant account activation/deletion.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/commerce/hubs?tab=delivery" className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-warm-cream">
            Delivery Runsheets
          </Link>
          <Link href="/admin/delivery-partners/riders" className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-warm-cream">
            Shifts, Cash &amp; Wallet
          </Link>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? "Syncing..." : "Refresh Live Locations"}
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${msg.err ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {msg.text}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-blue-950">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">Total Riders</p>
          <p className="mt-1 text-2xl font-black">{agents.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-emerald-950">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">Active / Approved</p>
          <p className="mt-1 text-2xl font-black">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-amber-950">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">Pending Activation / KYC</p>
          <p className="mt-1 text-2xl font-black">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 text-indigo-950">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">Live GPS Pings</p>
          <p className="mt-1 text-2xl font-black">{gpsLiveCount}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white p-3 shadow-sm">
        <TextInput
          className="flex-1 min-w-[240px]"
          placeholder="Search rider by name, email, phone, hub code, or vehicle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(["all", "approved", "pending", "located"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${statusFilter === f ? "bg-burgundy text-white" : "border border-border bg-white text-text-primary hover:bg-warm-cream"}`}
          >
            {f === "all" ? "All Riders" : f === "approved" ? "Active" : f === "pending" ? "Pending" : "With GPS / Hub"}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: Riders List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-muted">
              No delivery riders found matching your filter.
            </div>
          ) : (
            filtered.map((ag) => {
              const coords = getCoordsForRider(ag);
              const riderShipments = shipments.filter(
                (s) => (s.assignedAgentEmail || "").toLowerCase() === ag.email.toLowerCase()
              );
              const isSelected = selectedRider?.email === ag.email;
              const targetHub = hubMap[ag.email] ?? ag.hubCode ?? hubs[0]?.code ?? "";

              return (
                <div
                  key={ag.email}
                  onClick={() => setSelectedEmail(ag.email)}
                  className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition ${isSelected ? "border-burgundy ring-2 ring-burgundy/20" : "border-border hover:border-burgundy/40"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-extrabold text-text-primary">{ag.name || ag.email}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ag.status === "approved" ? "bg-emerald-100 text-emerald-900" : ag.status === "rejected" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"}`}>
                          {ag.status.toUpperCase()}
                        </span>
                        {ag.kyc?.status && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ag.kyc.status === "Approved" ? "bg-blue-100 text-blue-900" : "bg-slate-100 text-slate-800"}`}>
                            KYC: {ag.kyc.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {ag.email} {ag.phone ? `· ${ag.phone}` : ""} {ag.vehicleNo ? `· ${ag.vehicleNo}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-text-primary">
                        Hub: <b className="font-mono">{ag.hubCode || "Unassigned"}</b> · Assigned Parcels: <b>{riderShipments.length}</b>
                        {coords ? (
                          <span className="ml-2 text-emerald-700 font-semibold">
                            · 📍 {coords.source} ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                          </span>
                        ) : (
                          <span className="ml-2 text-amber-700">· No GPS coordinates yet</span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {coords && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                        >
                          Locate on Maps ↗
                        </a>
                      )}
                      {ag.status !== "approved" && (
                        <Button
                          disabled={busy}
                          onClick={() => void act({ action: "approve-agent", email: ag.email, hubCode: targetHub || "VGMF-PNQ" })}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Delete rider account ${ag.email}? They will be logged out immediately.`)) {
                            void act({ action: "delete-agent-account", email: ag.email });
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Quick Hub Assignment Row */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5" onClick={(e) => e.stopPropagation()}>
                    <SelectInput
                      className="w-48 text-xs"
                      value={targetHub}
                      onChange={(e) => setHubMap((m) => ({ ...m, [ag.email]: e.target.value }))}
                    >
                      <option value="">Select Hub...</option>
                      {hubs.map((h) => (
                        <option key={h.code} value={h.code}>{h.code} — {h.name}</option>
                      ))}
                    </SelectInput>
                    <Button
                      variant="outline"
                      disabled={busy || !targetHub}
                      onClick={() => void act({ action: "allot-agent-hub", email: ag.email, targetHubCode: targetHub })}
                    >
                      Assign Hub
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act({ action: "kyc-reinitiate", email: ag.email, reason: "Admin requested fresh KYC" })}
                    >
                      Reset KYC
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Live Map & Selected Rider Inspector */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm h-fit sticky top-4 space-y-4">
          <h2 className="text-sm font-extrabold text-text-primary">
            📍 Rider Live Locator {selectedRider ? `— ${selectedRider.name || selectedRider.email}` : ""}
          </h2>

          {!selectedRider ? (
            <p className="text-xs text-text-muted">Select a rider on the left to inspect their live location, KYC, and assigned shipments.</p>
          ) : (
            <>
              {selectedCoords ? (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-xl border border-border bg-slate-50">
                    <iframe
                      title="Rider Live Location"
                      className="h-64 w-full border-0"
                      loading="lazy"
                      src={`https://maps.google.com/maps?q=${selectedCoords.lat},${selectedCoords.lng}&z=15&output=embed`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-emerald-800">
                      {selectedCoords.source}: {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedCoords.lat},${selectedCoords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-blue-700 underline"
                    >
                      Open in Google Maps ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  <p className="font-bold">No GPS Ping Received Yet</p>
                  <p className="mt-1">
                    Assign a hub with GPS coordinates or wait for the rider to open the Delivery Executive app so their phone sends a live GPS ping.
                  </p>
                  {selectedHub?.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedHub.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block font-bold underline"
                    >
                      Locate Assigned Hub ({selectedHub.code}) on Maps ↗
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-1.5 rounded-xl border border-border bg-warm-cream/40 p-3 text-xs">
                <p><b>Name:</b> {selectedRider.name || "—"}</p>
                <p><b>Email:</b> {selectedRider.email}</p>
                <p><b>Phone:</b> {selectedRider.phone || "—"}</p>
                <p><b>Vehicle:</b> {selectedRider.vehicleNo || "—"}</p>
                <p><b>Hub:</b> {selectedRider.hubCode || "Unassigned"} {selectedHub?.name ? `(${selectedHub.name})` : ""}</p>
                <p>
                  <b>KYC:</b> {selectedRider.kyc?.status || "Not Started"} ({selectedRider.kyc?.documentType || "ID"} {selectedRider.kyc?.documentNumber || ""})
                </p>
                {selectedRider.kyc?.faceMatchScore !== undefined && (
                  <p><b>Biometric Match:</b> Face {selectedRider.kyc.faceMatchScore}% · Liveness {selectedRider.kyc.livenessScore}%</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-text-muted">Assigned Active Parcels</p>
                {shipments.filter((s) => (s.assignedAgentEmail || "").toLowerCase() === selectedRider.email.toLowerCase()).length === 0 ? (
                  <p className="text-xs text-text-muted">No parcels currently assigned to this rider.</p>
                ) : (
                  shipments
                    .filter((s) => (s.assignedAgentEmail || "").toLowerCase() === selectedRider.email.toLowerCase())
                    .map((s) => (
                      <div key={s.shipmentId} className="rounded-lg border border-border p-2 text-xs">
                        <p className="font-mono font-bold">{s.awb}</p>
                        <p className="text-text-muted">{s.customerName} · {s.city} · {s.status}</p>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
