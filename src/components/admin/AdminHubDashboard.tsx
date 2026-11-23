"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, SelectInput, TextInput } from "@/components/admin/AdminUI";

function StatusBadge({ tone, children }: { tone: "emerald" | "blue" | "amber" | "red"; children: React.ReactNode }) {
  const cls = tone === "emerald" ? "bg-emerald-100 text-emerald-900" : tone === "blue" ? "bg-blue-100 text-blue-900" : tone === "red" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

type HubType = "delivery_pickup" | "warehouse" | "sorting_facility" | "combined";

type HubSection =
  | "overview"
  | "inward"
  | "sorting"
  | "bagging"
  | "manifests"
  | "transfers"
  | "delivery"
  | "returns"
  | "exceptions"
  | "staff_gate"
  | "reports";

const HUB_TYPE_LABEL: Record<HubType, string> = {
  delivery_pickup: "Delivery & Pickup Hub",
  warehouse: "Warehouse",
  sorting_facility: "Sorting Facility",
  combined: "Combined Hub & Warehouse",
};

const SIDEBAR_GROUPS: { group: string; items: { id: HubSection; label: string }[] }[] = [
  { group: "OVERVIEW", items: [{ id: "overview", label: "Hub Dashboard" }] },
  {
    group: "OPERATIONS",
    items: [
      { id: "inward", label: "Inward & Outward" },
      { id: "sorting", label: "Sorting & Racks" },
      { id: "bagging", label: "Bagging" },
      { id: "manifests", label: "Manifests" },
      { id: "transfers", label: "Hub Transfers" },
    ],
  },
  {
    group: "LAST-MILE & RETURNS",
    items: [
      { id: "delivery", label: "Partner Runsheets" },
      { id: "returns", label: "Return Management" },
    ],
  },
  {
    group: "CONTROL & STAFF",
    items: [
      { id: "exceptions", label: "Exceptions & CCTV" },
      { id: "staff_gate", label: "Staff & Gate Register" },
      { id: "reports", label: "Reports & Audit Trail" },
    ],
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AdminHubDashboard({ lockedHubCode, operatorName }: { lockedHubCode?: string; operatorName?: string } = {}) {
  const [section, setSection] = useState<HubSection>("overview");
  const [hubCode, setHubCode] = useState(lockedHubCode || "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  // Form states
  const [inwardScan, setInwardScan] = useState("");
  const [rackAwb, setRackAwb] = useState("");
  const [rackBin, setRackBin] = useState("Rack A1");
  const [bagDest, setBagDest] = useState("VGMF-THN");
  const [bagSeal, setBagSeal] = useState("");
  const [bagScanMap, setBagScanMap] = useState<Record<string, string>>({});
  const [trfDest, setTrfDest] = useState("VGMF-THN");
  const [trfVehicle, setTrfVehicle] = useState("");
  const [trfDriver, setTrfDriver] = useState("");
  const [trfBags, setTrfBags] = useState<string[]>([]);
  const [manType, setManType] = useState("dispatch_manifest");
  const [manVehicle, setManVehicle] = useState("");
  const [assignAwb, setAssignAwb] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assignName, setAssignName] = useState("");

  // Return form
  const [retCode, setRetCode] = useState("");
  const [retKind, setRetKind] = useState<"customer_return" | "rto">("customer_return");
  const [retReason, setRetReason] = useState("Customer return requested");

  // Exception form
  const [excCode, setExcCode] = useState("");
  const [excCat, setExcCat] = useState("missing_shipment");
  const [excNotes, setExcNotes] = useState("");
  const [excCctv, setExcCctv] = useState("");

  // Staff & Gate forms
  const [execName, setExecName] = useState("");
  const [execEmail, setExecEmail] = useState("");
  const [execPhone, setExecPhone] = useState("");
  const [execRole, setExecRole] = useState("delivery_executive");
  const [execShift, setExecShift] = useState("Morning (08:00–16:00)");
  const [execStation, setExecStation] = useState("Inward / Sorting");
  const [execPassword, setExecPassword] = useState("");
  const [allotHubMap, setAllotHubMap] = useState<Record<string, string>>({});

  const [gateVeh, setGateVeh] = useState("");
  const [gateDriver, setGateDriver] = useState("");
  const [gatePhone, setGatePhone] = useState("");
  const [gatePurpose, setGatePurpose] = useState("Hub Transfer");
  const [gateBags, setGateBags] = useState("0");

  // New hub form
  const [showAddHub, setShowAddHub] = useState(false);
  const [nhCode, setNhCode] = useState("");
  const [nhName, setNhName] = useState("");
  const [nhType, setNhType] = useState<HubType>("delivery_pickup");
  const [nhCity, setNhCity] = useState("");
  const [nhAddress, setNhAddress] = useState("");
  const [nhPin, setNhPin] = useState("");
  const [nhLat, setNhLat] = useState<number | undefined>(undefined);
  const [nhLng, setNhLng] = useState<number | undefined>(undefined);
  const [nhMapsUrl, setNhMapsUrl] = useState("");

  const load = useCallback(async (targetHub = hubCode) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/hub-ops?hubCode=${encodeURIComponent(targetHub)}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setData(j); if (!targetHub && j.hubs?.length) setHubCode(j.hubs[0].code); }
    } catch {
      setMsg({ text: "Could not load Hub Operations data.", err: true });
    } finally {
      setLoading(false);
    }
  }, [hubCode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab") as HubSection | null;
      if (t) setSection(t);
    }
  }, []);
  useEffect(() => {
    void load(hubCode);
  }, [hubCode, load]);

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/hub-ops", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hubCode: lockedHubCode || hubCode, ...(operatorName ? { by: operatorName } : {}), ...payload }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Operation failed.");
      setMsg({ text: j.message || "Done." });
      await load(hubCode);
      return j;
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Operation failed.", err: true });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const activeHub = data?.hubDashboard?.hub;
  const hubs = data?.hubs || [];
  const inwardShipments = data?.hubDashboard?.inwardShipments || [];
  const outwardShipments = data?.hubDashboard?.outwardShipments || [];
  const openExceptions = (data?.exceptions || []).filter((e: { status: string }) => e.status === "Open");

  const exportCsv = () => {
    const rows = [
      ["AWB", "Order ID", "Status", "Customer", "City", "Pincode", "Hub", "Executive"],
      ...(data?.activeShipments || []).map((s: Record<string, string>) => [
        s.awb,
        s.orderId,
        s.status,
        s.customerName,
        s.city,
        s.pincode,
        s.currentHubCode || hubCode,
        s.agentName || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vgmf-hub-${hubCode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-6">
      {/* Top Hub Header Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-text-primary">
              {activeHub ? activeHub.name : "VGMF Hub Operations"}
            </h1>
            {activeHub && (
              <StatusBadge tone="emerald">
                {HUB_TYPE_LABEL[(activeHub.type as HubType) || "combined"]}
              </StatusBadge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Hub Code: <span className="font-mono font-bold text-text-primary">{hubCode}</span>
            {activeHub ? ` · ${activeHub.city} · ${activeHub.executives?.length || 0} Executives` : ""}
            {" · 12-Digit VGMF AWB · Mandatory Scan + 6-Digit Pickup/Delivery OTP"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!lockedHubCode && <SelectInput value={hubCode} onChange={(e) => setHubCode(e.target.value)} className="w-60">
            {hubs.map((h: { code: string; name: string; type: HubType }) => (
              <option key={h.code} value={h.code}>
                {h.code} — {h.name} ({HUB_TYPE_LABEL[h.type] || h.type})
              </option>
            ))}
          </SelectInput>}
          {!lockedHubCode && <Button variant="outline" onClick={() => setShowAddHub((v) => !v)}>+ Add Hub</Button>}
          <Button variant="outline" onClick={() => void load(hubCode)} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {showAddHub && (
        <div className="mb-4 space-y-2.5 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <p className="text-xs font-extrabold text-blue-950">Add VGMF Hub (Leave Hub Code blank to auto-generate e.g. VGMF-PUN-001 · Fetch GPS via Google Maps API)</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <TextInput placeholder="Hub Code (blank = Auto)" value={nhCode} onChange={(e) => setNhCode(e.target.value)} />
            <TextInput placeholder="Hub Name (e.g. Pune Main Hub)" value={nhName} onChange={(e) => setNhName(e.target.value)} />
            <SelectInput value={nhType} onChange={(e) => setNhType(e.target.value as HubType)}>
              <option value="delivery_pickup">Delivery &amp; Pickup Hub</option>
              <option value="warehouse">Warehouse</option>
              <option value="sorting_facility">Sorting Facility</option>
              <option value="combined">Combined Hub</option>
            </SelectInput>
            <TextInput placeholder="City, State" value={nhCity} onChange={(e) => setNhCity(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <TextInput className="flex-1 min-w-[240px]" placeholder="Full Address or Pincode for Google Maps Lookup" value={nhAddress} onChange={(e) => setNhAddress(e.target.value)} />
            <TextInput className="w-32" placeholder="Pincode" value={nhPin} onChange={(e) => setNhPin(e.target.value)} />
            <Button variant="outline" disabled={busy || (!nhAddress.trim() && !nhCity.trim() && !nhPin.trim())} onClick={async () => {
              const q = [nhAddress, nhCity, nhPin].filter(Boolean).join(", ");
              const res = await act({ action: "geocode-hub", query: q });
              if (res?.ok) {
                if (res.formattedAddress) setNhAddress(res.formattedAddress);
                if (res.city) setNhCity(res.city);
                if (res.pincode) setNhPin(res.pincode);
                if (res.lat) setNhLat(res.lat);
                if (res.lng) setNhLng(res.lng);
                if (res.mapsUrl) setNhMapsUrl(res.mapsUrl);
              }
            }}>Lookup Google Maps GPS</Button>
            <Button disabled={busy || !nhName.trim() || !nhCity.trim()} onClick={async () => {
              const res = await act({ action: "add-hub", code: nhCode, name: nhName, type: nhType, city: nhCity, pincode: nhPin, address: nhAddress, lat: nhLat, lng: nhLng, mapsUrl: nhMapsUrl });
              if (res?.hub?.code) {
                setHubCode(res.hub.code);
                setShowAddHub(false);
                setNhCode(""); setNhName(""); setNhCity(""); setNhAddress(""); setNhPin(""); setNhLat(undefined); setNhLng(undefined); setNhMapsUrl("");
              }
            }}>Save Hub</Button>
          </div>
          {nhLat && nhLng ? (
            <p className="text-xs text-emerald-800 font-semibold">
              GPS Verified: {nhLat.toFixed(5)}, {nhLng.toFixed(5)} · <a href={nhMapsUrl} target="_blank" rel="noreferrer" className="underline">View on Google Maps ↗</a>
            </p>
          ) : null}
        </div>
      )}

      {msg && (
        <div className={`mb-4 rounded-xl border px-4 py-2.5 text-sm font-medium ${msg.err ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Sidebar Navigation */}
        <aside className="rounded-2xl border border-border bg-white p-3 shadow-sm h-fit">
          <p className="px-2 pb-2 text-xs font-extrabold uppercase tracking-wider text-burgundy">VGMF Hub Operations</p>
          <div className="space-y-3">
            {SIDEBAR_GROUPS.map((g) => (
              <div key={g.group}>
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">{g.group}</p>
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                        section === item.id
                          ? "bg-burgundy text-white"
                          : "text-text-primary hover:bg-warm-cream"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="space-y-4">
          {/* 1. OVERVIEW */}
          {section === "overview" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {[
                  ["Awaiting Pickup", data?.stats?.awaitingPickup ?? 0, "border-amber-200 bg-amber-50/50 text-amber-950"],
                  ["Hub Inward", inwardShipments.length, "border-blue-200 bg-blue-50/50 text-blue-950"],
                  ["Hub Outward", outwardShipments.length, "border-indigo-200 bg-indigo-50/50 text-indigo-950"],
                  ["Out for Delivery", data?.stats?.outForDelivery ?? 0, "border-emerald-200 bg-emerald-50/50 text-emerald-950"],
                  ["Bags In Transit", data?.stats?.inTransitBags ?? 0, "border-slate-200 bg-slate-50 text-slate-900"],
                  ["Open Exceptions", openExceptions.length, "border-red-200 bg-red-50/50 text-red-900"],
                ].map(([label, val, tone]) => (
                  <div key={String(label)} className={`rounded-xl border p-3.5 ${tone}`}>
                    <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">{label}</p>
                    <p className="mt-1 text-2xl font-black">{val}</p>
                  </div>
                ))}
              </div>

              {(data?.agingAlerts?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-950">Shipment Aging Alerts ({data.agingAlerts.length} parcels &gt; 48h)</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {data.agingAlerts.slice(0, 6).map((a: { awb: string; orderId: string; city: string; hoursStuck: number }) => (
                      <div key={a.awb} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <span className="font-mono font-bold">{a.awb}</span> · Order #{a.orderId} · {a.city} · <b className="text-red-700">{a.hoursStuck}h</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-text-primary">First-Mile Orders — Generate 12-Digit VGMF AWB &amp; Labels ({data?.firstMile?.length ?? 0})</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-muted">
                        <th className="py-2 pr-3">Order #</th>
                        <th className="py-2 pr-3">Customer &amp; City</th>
                        <th className="py-2 pr-3">12-Digit AWB</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.firstMile || []).slice(0, 20).map((o: { orderId: string; customerName: string; city: string; pincode: string; awb: string; shipmentStatus: string }) => (
                        <tr key={o.orderId} className="border-b border-border/50">
                          <td className="py-2 pr-3 font-mono font-bold">#{o.orderId}</td>
                          <td className="py-2 pr-3">{o.customerName} · {o.city} {o.pincode}</td>
                          <td className="py-2 pr-3 font-mono font-bold text-blue-800">{o.awb || "—"}</td>
                          <td className="py-2 pr-3">{o.shipmentStatus}</td>
                          <td className="flex flex-wrap gap-1.5 py-2">
                            {!o.awb ? (
                              <Button variant="outline" disabled={busy} onClick={() => void act({ action: "generate-awb", orderId: o.orderId })}>
                                Generate 12-Digit AWB
                              </Button>
                            ) : (
                              <>
                                <a href={`/api/admin/vgmf-label?awb=${encodeURIComponent(o.awb)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2.5 py-1 font-semibold hover:bg-warm-cream">
                                  Print Label
                                </a>
                                <Button variant="ghost" disabled={busy} onClick={() => void act({ action: "scan-event", code: o.awb, event: "out_for_pickup" })}>
                                  Out for Pickup (Send OTP)
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 2. INWARD & OUTWARD */}
          {section === "inward" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-text-primary">Continuous Hub Inward Scanner ({hubCode})</h2>
                <p className="text-xs text-text-muted">Scan 12-digit AWB barcode or Bag ID to physically receive parcel into {hubCode}.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TextInput
                    className="max-w-sm font-mono"
                    placeholder="Scan or enter 12-digit AWB / Bag ID…"
                    value={inwardScan}
                    onChange={(e) => setInwardScan(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && inwardScan.trim()) {
                        const code = inwardScan.trim();
                        setInwardScan("");
                        void act(code.toUpperCase().startsWith("BAG-") ? { action: "bag-receive", bagId: code } : { action: "scan-event", code, event: "hub_inscan" });
                      }
                    }}
                  />
                  <Button disabled={busy || !inwardScan.trim()} onClick={() => {
                    const code = inwardScan.trim();
                    setInwardScan("");
                    void act(code.toUpperCase().startsWith("BAG-") ? { action: "bag-receive", bagId: code } : { action: "scan-event", code, event: "hub_inscan" });
                  }}>Inward Scan</Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-blue-950">Inward Shipments at {hubCode} ({inwardShipments.length})</h3>
                  <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
                    {inwardShipments.map((s: { awb: string; orderId: string; customerName: string; city: string; status: string }) => (
                      <div key={s.awb} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs">
                        <div>
                          <p className="font-mono font-bold">{s.awb} <span className="font-sans font-normal text-text-muted">· #{s.orderId}</span></p>
                          <p className="text-text-muted">{s.customerName} · {s.city}</p>
                        </div>
                        <StatusBadge tone="blue">{s.status}</StatusBadge>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-indigo-950">Outward Shipments from {hubCode} ({outwardShipments.length})</h3>
                  <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
                    {outwardShipments.map((s: { awb: string; orderId: string; customerName: string; city: string; status: string }) => (
                      <div key={s.awb} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs">
                        <div>
                          <p className="font-mono font-bold">{s.awb} <span className="font-sans font-normal text-text-muted">· #{s.orderId}</span></p>
                          <p className="text-text-muted">{s.customerName} · {s.city}</p>
                        </div>
                        <StatusBadge tone="emerald">{s.status}</StatusBadge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. SORTING & RACKS */}
          {section === "sorting" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-text-primary">Physical Rack / Bin Allocation</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <TextInput className="w-56 font-mono" placeholder="12-Digit AWB" value={rackAwb} onChange={(e) => setRackAwb(e.target.value)} />
                  <SelectInput className="w-44" value={rackBin} onChange={(e) => setRackBin(e.target.value)}>
                    {["Rack A1", "Rack A2", "Rack B1", "Rack B2", "Bin C1", "Bin C2", "Priority Zone", "COD Zone", "Fragile Rack"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </SelectInput>
                  <Button disabled={busy || !rackAwb.trim()} onClick={async () => {
                    const res = await act({ action: "set-rack-bin", code: rackAwb, rackBin });
                    if (res) setRackAwb("");
                  }}>Allocate Rack/Bin</Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-text-primary">Destination Sorting Queue (Grouped by City &amp; Pincode)</h2>
                <table className="mt-3 w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="py-2">Destination</th>
                      <th className="py-2">Pincodes</th>
                      <th className="py-2">Shipments</th>
                      <th className="py-2">COD</th>
                      <th className="py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.sortingGroups || []).map((g: { destination: string; pincodes: string[]; count: number; codCount: number }) => (
                      <tr key={g.destination} className="border-b border-border/50">
                        <td className="py-2 font-bold">{g.destination}</td>
                        <td className="py-2 font-mono text-text-muted">{g.pincodes.join(", ") || "—"}</td>
                        <td className="py-2 font-bold">{g.count}</td>
                        <td className="py-2">{g.codCount}</td>
                        <td className="py-2">
                          <Button variant="outline" onClick={() => setSection("bagging")}>Create Bag / Route</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. BAGGING */}
          {section === "bagging" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-text-primary">Create Internal Bag from {hubCode}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <SelectInput className="w-56" value={bagDest} onChange={(e) => setBagDest(e.target.value)}>
                    {hubs.filter((h: { code: string }) => h.code !== hubCode).map((h: { code: string; name: string }) => (
                      <option key={h.code} value={h.code}>→ {h.code} ({h.name})</option>
                    ))}
                  </SelectInput>
                  <TextInput className="w-44" placeholder="Seal No (optional)" value={bagSeal} onChange={(e) => setBagSeal(e.target.value)} />
                  <Button disabled={busy} onClick={() => void act({ action: "bag-create", destHub: bagDest, sealNo: bagSeal })}>Create Bag</Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {(data?.bags || []).map((bag: { id: string; originHub: string; destHub: string; status: string; sealNo?: string; awbs: string[] }) => (
                  <div key={bag.id} className="rounded-xl border border-border bg-white p-4 text-xs shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">{bag.id}</span>
                      <StatusBadge tone={bag.status === "Debagged" ? "emerald" : bag.status === "In Transit" ? "blue" : "amber"}>{bag.status}</StatusBadge>
                    </div>
                    <p className="font-semibold text-blue-900">{bag.originHub} → {bag.destHub} · {bag.awbs.length} parcels {bag.sealNo ? `· Seal ${bag.sealNo}` : ""}</p>
                    {bag.awbs.length > 0 && <p className="font-mono text-[11px] text-text-muted break-all">{bag.awbs.join(", ")}</p>}
                    {bag.status === "Open" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <TextInput
                          className="w-44 font-mono"
                          placeholder="Scan 12-digit AWB"
                          value={bagScanMap[bag.id] || ""}
                          onChange={(e) => setBagScanMap((m) => ({ ...m, [bag.id]: e.target.value }))}
                        />
                        <Button variant="outline" disabled={busy} onClick={async () => {
                          const code = (bagScanMap[bag.id] || "").trim();
                          if (!code) return;
                          const res = await act({ action: "bag-add-awb", bagId: bag.id, code });
                          if (res) setBagScanMap((m) => ({ ...m, [bag.id]: "" }));
                        }}>Add AWB</Button>
                        <Button disabled={busy} onClick={() => void act({ action: "bag-seal", bagId: bag.id, sealNo: bagSeal })}>Seal Bag</Button>
                      </div>
                    )}
                    {bag.status === "Sealed" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button disabled={busy} onClick={() => void act({ action: "bag-dispatch", bagId: bag.id, destHub: bag.destHub })}>Dispatch Transfer</Button>
                        <Button variant="ghost" disabled={busy} onClick={() => {
                          const reason = window.prompt("Supervisor Audit Reason to reopen sealed bag:");
                          if (reason) void act({ action: "bag-reopen", bagId: bag.id, reason });
                        }}>Supervisor Reopen</Button>
                      </div>
                    )}
                    {bag.status === "In Transit" && (
                      <Button disabled={busy} onClick={() => void act({ action: "bag-receive", bagId: bag.id })}>Receive &amp; Debag at {hubCode}</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. MANIFESTS */}
          {section === "manifests" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
                <h2 className="text-sm font-bold text-text-primary">Generate Printable VGMF Manifest (All 6 Types)</h2>
                <div className="flex flex-wrap gap-2">
                  <SelectInput className="w-56" value={manType} onChange={(e) => setManType(e.target.value)}>
                    <option value="inward_manifest">Inward Manifest</option>
                    <option value="bag_manifest">Bag Manifest</option>
                    <option value="hub_transfer">Transfer Manifest</option>
                    <option value="vehicle_manifest">Vehicle Manifest</option>
                    <option value="last_mile_ofd">Delivery Manifest</option>
                    <option value="return_manifest">Return Manifest</option>
                  </SelectInput>
                  <TextInput className="w-44" placeholder="Vehicle No" value={manVehicle} onChange={(e) => setManVehicle(e.target.value)} />
                  <Button disabled={busy} onClick={async () => {
                    const awbs = (data?.activeShipments || []).map((s: { awb: string }) => s.awb);
                    const bagIds = (data?.bags || []).filter((b: { status: string }) => b.status === "Sealed" || b.status === "In Transit").map((b: { id: string }) => b.id);
                    const res = await act({ action: "manifest-create", type: manType, vehicleNo: manVehicle, awbs, bagIds });
                    if (res?.manifestUrl) window.open(res.manifestUrl, "_blank");
                  }}>Create &amp; Print Manifest</Button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2">
                <h3 className="text-sm font-bold">Manifest History ({data?.manifests?.length ?? 0})</h3>
                {(data?.manifests || []).map((m: { id: string; type: string; hubCode: string; awbs: string[]; createdAt: string }) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs">
                    <div>
                      <span className="font-mono font-bold">{m.id}</span> · {m.type.replace(/_/g, " ")} · {m.hubCode} · {m.awbs.length} AWBs
                    </div>
                    <a href={`/api/admin/vgmf-manifest?id=${encodeURIComponent(m.id)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2.5 py-1 font-semibold hover:bg-warm-cream">
                      Print / PDF
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. HUB TRANSFERS */}
          {section === "transfers" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
                <h2 className="text-sm font-bold text-text-primary">Initiate Internal Hub Transfer from {hubCode}</h2>
                <div className="flex flex-wrap gap-2">
                  <SelectInput className="w-52" value={trfDest} onChange={(e) => setTrfDest(e.target.value)}>
                    {hubs.filter((h: { code: string }) => h.code !== hubCode).map((h: { code: string; name: string }) => (
                      <option key={h.code} value={h.code}>→ {h.code} ({h.name})</option>
                    ))}
                  </SelectInput>
                  <TextInput className="w-40" placeholder="Vehicle No (MH12...)" value={trfVehicle} onChange={(e) => setTrfVehicle(e.target.value)} />
                  <TextInput className="w-44" placeholder="Driver Name" value={trfDriver} onChange={(e) => setTrfDriver(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(data?.bags || []).filter((b: { status: string }) => b.status === "Sealed").map((b: { id: string; awbs: string[] }) => (
                    <label key={b.id} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1">
                      <input
                        type="checkbox"
                        checked={trfBags.includes(b.id)}
                        onChange={(e) => setTrfBags((list) => (e.target.checked ? [...list, b.id] : list.filter((x) => x !== b.id)))}
                      />
                      <span className="font-mono font-bold">{b.id}</span> ({b.awbs.length})
                    </label>
                  ))}
                </div>
                <Button disabled={busy || !trfBags.length || !trfVehicle.trim()} onClick={async () => {
                  const res = await act({ action: "transfer-create", destHub: trfDest, bagIds: trfBags, vehicleNo: trfVehicle, driverName: trfDriver });
                  if (res) { setTrfBags([]); setTrfVehicle(""); setTrfDriver(""); }
                }}>Dispatch Hub Transfer</Button>
              </div>
              <div className="space-y-2">
                {(data?.transfers || []).map((t: { id: string; originHub: string; destHub: string; vehicleNo: string; driverName: string; bagIds: string[]; parcelCount: number; status: string }) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white p-3.5 text-xs">
                    <div>
                      <p className="font-mono text-sm font-bold">{t.id} · {t.originHub} → {t.destHub}</p>
                      <p className="text-text-muted">Vehicle {t.vehicleNo} ({t.driverName}) · {t.bagIds.length} Bags · {t.parcelCount} Parcels</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={t.status === "Received" ? "emerald" : "blue"}>{t.status}</StatusBadge>
                      {t.status === "In Transit" && (
                        <Button variant="outline" disabled={busy} onClick={() => void act({ action: "transfer-receive", transferId: t.id })}>
                          Receive &amp; Reconcile at {hubCode}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. DELIVERY PARTNER RUNSHEETS */}
          {section === "delivery" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2">
                <h2 className="text-sm font-bold text-text-primary">Assign Parcel to Delivery Partner Runsheet (Sends 6-Digit Customer OTP · No Rider GPS Shared)</h2>
                <div className="flex flex-wrap gap-2">
                  <TextInput className="w-48 font-mono" placeholder="12-Digit AWB" value={assignAwb} onChange={(e) => setAssignAwb(e.target.value)} />
                  <TextInput className="w-56" placeholder="Partner Email / ID" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} />
                  <TextInput className="w-44" placeholder="Partner Name" value={assignName} onChange={(e) => setAssignName(e.target.value)} />
                  <Button disabled={busy || !assignAwb.trim() || !assignEmail.trim()} onClick={async () => {
                    const res = await act({ action: "assign-runsheet", code: assignAwb, agentEmail: assignEmail, agentName: assignName || assignEmail });
                    if (res) setAssignAwb("");
                  }}>Assign to Runsheet</Button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold">Active Delivery Partner Assignments</h3>
                <table className="mt-2 w-full text-left text-xs">
                  <thead><tr className="border-b border-border text-text-muted"><th className="py-2">Partner</th><th className="py-2">Assigned</th><th className="py-2">Pending</th></tr></thead>
                  <tbody>
                    {(data?.partnerSummary || []).map((p: { partner: string; email: string; assigned: number; pending: number }) => (
                      <tr key={p.email || p.partner} className="border-b border-border/50">
                        <td className="py-2 font-bold">{p.partner} <span className="font-normal text-text-muted">({p.email})</span></td>
                        <td className="py-2">{p.assigned}</td>
                        <td className="py-2 font-bold text-amber-800">{p.pending}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. RETURN MANAGEMENT */}
          {section === "returns" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2">
                <h2 className="text-sm font-bold text-text-primary">Initiate Customer Return or RTO (12-Digit Return AWB + 6-Digit OTP)</h2>
                <div className="flex flex-wrap gap-2">
                  <TextInput className="w-48 font-mono" placeholder="Order # or AWB" value={retCode} onChange={(e) => setRetCode(e.target.value)} />
                  <SelectInput className="w-44" value={retKind} onChange={(e) => setRetKind(e.target.value as "customer_return" | "rto")}>
                    <option value="customer_return">Customer Return</option>
                    <option value="rto">RTO (Undelivered)</option>
                  </SelectInput>
                  <TextInput className="w-60" placeholder="Reason" value={retReason} onChange={(e) => setRetReason(e.target.value)} />
                  <Button disabled={busy || !retCode.trim()} onClick={async () => {
                    const res = await act({ action: "return-create", code: retCode, kind: retKind, reason: retReason });
                    if (res) setRetCode("");
                  }}>Create Return AWB</Button>
                </div>
              </div>
              <div className="space-y-2">
                {(data?.returns || []).map((r: { returnAwb: string; originalOrderId: string; kind: string; status: string; customerName: string; reason: string }) => (
                  <div key={r.returnAwb} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-xs">
                    <div>
                      <p className="font-mono font-bold">{r.returnAwb} <span className="font-sans text-text-muted">· Order #{r.originalOrderId} · {r.kind.toUpperCase()}</span></p>
                      <p className="text-text-muted">{r.customerName} — {r.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={r.status === "Returned to Seller" ? "emerald" : "amber"}>{r.status}</StatusBadge>
                      {r.status === "Initiated" && (
                        <Button variant="outline" disabled={busy} onClick={() => void act({ action: "return-event", returnAwb: r.returnAwb, event: "out_for_return_pickup" })}>Out for Return Pickup</Button>
                      )}
                      {r.status === "Return Picked Up" && (
                        <Button variant="outline" disabled={busy} onClick={() => void act({ action: "return-event", returnAwb: r.returnAwb, event: "return_hub_inscan" })}>Hub In-Scan</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. EXCEPTIONS & CCTV */}
          {section === "exceptions" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2">
                <h2 className="text-sm font-bold text-text-primary">Log Hub Exception Case (with CCTV Reference)</h2>
                <div className="flex flex-wrap gap-2">
                  <TextInput className="w-44 font-mono" placeholder="AWB / Bag ID" value={excCode} onChange={(e) => setExcCode(e.target.value)} />
                  <SelectInput className="w-48" value={excCat} onChange={(e) => setExcCat(e.target.value)}>
                    <option value="missing_shipment">Missing Shipment</option>
                    <option value="damaged_parcel">Damaged Parcel</option>
                    <option value="wrong_hub">Wrong Hub Received</option>
                    <option value="weight_discrepancy">Weight Discrepancy</option>
                    <option value="unidentified_barcode">Unidentified Barcode</option>
                    <option value="transfer_shortage">Transfer Shortage</option>
                  </SelectInput>
                  <TextInput className="w-48" placeholder="CCTV Cam / Time Ref" value={excCctv} onChange={(e) => setExcCctv(e.target.value)} />
                  <TextInput className="w-60" placeholder="Supervisor notes" value={excNotes} onChange={(e) => setExcNotes(e.target.value)} />
                  <Button disabled={busy} onClick={async () => {
                    const res = await act({ action: "exception-create", code: excCode, category: excCat, notes: excNotes, cctvRef: excCctv });
                    if (res) { setExcCode(""); setExcNotes(""); setExcCctv(""); }
                  }}>Open Case</Button>
                </div>
              </div>
              <div className="space-y-2">
                {(data?.exceptions || []).map((ex: { id: string; code: string; category: string; status: string; notes: string; cctvRef?: string }) => (
                  <div key={ex.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-xs">
                    <div>
                      <p className="font-mono font-bold">{ex.id} · {ex.code} ({ex.category.replace(/_/g, " ")})</p>
                      <p className="text-text-muted">{ex.notes}{ex.cctvRef ? ` · CCTV: ${ex.cctvRef}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={ex.status === "Resolved" ? "emerald" : "red"}>{ex.status}</StatusBadge>
                      {ex.status === "Open" && (
                        <Button variant="outline" disabled={busy} onClick={() => {
                          const resText = window.prompt("Supervisor resolution & closure note:");
                          if (resText) void act({ action: "exception-resolve", caseId: ex.id, resolution: resText });
                        }}>Resolve &amp; Close</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. STAFF & GATE REGISTER */}
          {section === "staff_gate" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                      Delivery Agent KYC Pipeline &amp; Hub Activation ({(data?.agentEnrollments || []).length})
                    </p>
                    <span className="text-[11px] font-semibold text-blue-800">Manual · AccuraScan AI KYC</span>
                  </div>
                  {(data?.agentEnrollments || []).length === 0 ? (
                    <p className="text-xs text-text-muted">No delivery partner enrollments yet. When a partner signs up, selects a hub, and submits KYC in the app, their live 5-stage KYC pipeline will appear here.</p>
                  ) : (
                    (data?.agentEnrollments || []).map((ag: { email: string; name: string; phone?: string; vehicleNo?: string; hubCode: string; status: string; kyc?: { provider?: string; status?: string; verificationUrl?: string; sessionId?: string; documentType?: string; documentNumber?: string; idPhotoUrl?: string; selfiePhotoUrl?: string; faceMatchScore?: number; livenessScore?: number }; kycPipeline?: { id: string; title: string; state: string; at?: string; detail?: string }[] }) => (
                      <div key={ag.email} className="rounded-xl border border-blue-200 bg-white p-3.5 text-xs space-y-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm text-text-primary">{ag.name} <span className="font-normal text-text-muted">({ag.email})</span></p>
                            <p className="text-text-muted">Hub: <b className="font-mono">{ag.hubCode || "Unassigned"}</b>{hubs.find((h: { code: string; name: string }) => h.code === ag.hubCode)?.name ? ` (${hubs.find((h: { code: string; name: string }) => h.code === ag.hubCode)?.name})` : ""}{ag.phone ? ` · ${ag.phone}` : ""}{ag.vehicleNo ? ` · ${ag.vehicleNo}` : ""} · {ag.kyc?.provider === "accurascan" ? "AccuraScan AI KYC" : "Manual KYC"}: <b>{ag.kyc?.status || "Not Started"}</b>{ag.kyc?.provider === "accurascan" && (ag.kyc?.faceMatchScore !== undefined || ag.kyc?.livenessScore !== undefined) ? ` (Face ${ag.kyc?.faceMatchScore ?? "—"}% · Liveness ${ag.kyc?.livenessScore ?? "—"}%)` : ""}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ag.kyc?.status !== "Approved" && (
                              <Button variant="outline" disabled={busy} onClick={() => void act({ action: "kyc-manual-review", email: ag.email, approve: true })}>Verify KYC ✓</Button>
                            )}
                            {ag.kyc?.status !== "Declined" && (
                              <Button variant="ghost" disabled={busy} onClick={() => {
                                const reason = window.prompt("Reason for declining KYC:") || "Document unclear";
                                void act({ action: "kyc-manual-review", email: ag.email, approve: false, reason });
                              }}>Decline KYC</Button>
                            )}
                            <Button variant="outline" disabled={busy} onClick={() => {
                              const reason = window.prompt("Reason for re-initiating KYC (optional):") || "Fresh KYC requested by Admin";
                              void act({ action: "kyc-reinitiate", email: ag.email, reason });
                            }}>Re-initiate KYC</Button>
                            <Button variant="ghost" className="text-red-600 hover:bg-red-50" disabled={busy} onClick={() => {
                              if (window.confirm(`Permanently delete delivery agent account ${ag.name} (${ag.email})? This removes their hub enrollment and login account.`)) {
                                void act({ action: "delete-agent-account", email: ag.email });
                              }
                            }}>Delete Account</Button>
                            {ag.status !== "approved" && (
                              <>
                                <Button disabled={busy} onClick={() => void act({ action: "approve-agent", email: ag.email, role: "delivery_executive" })}>Approve &amp; Activate</Button>
                                <Button variant="ghost" disabled={busy} onClick={() => void act({ action: "reject-agent", email: ag.email })}>Reject</Button>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Admin Hub Allotment + Manual KYC Docs */}
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <span className="font-bold text-slate-700">Allot to Hub:</span>
                          <SelectInput
                            className="w-48"
                            value={allotHubMap[ag.email] ?? ag.hubCode ?? ""}
                            onChange={(e) => setAllotHubMap((m) => ({ ...m, [ag.email]: e.target.value }))}
                          >
                            <option value="">Select Hub…</option>
                            {hubs.map((h: { code: string; name: string }) => (
                              <option key={h.code} value={h.code}>{h.code} — {h.name}</option>
                            ))}
                          </SelectInput>
                          <Button
                            variant="outline"
                            disabled={busy || !(allotHubMap[ag.email] ?? ag.hubCode)}
                            onClick={() => void act({ action: "allot-agent-hub", email: ag.email, targetHubCode: allotHubMap[ag.email] ?? ag.hubCode })}
                          >
                            Allot Hub
                          </Button>
                          {ag.kyc?.documentType && (
                            <span className="ml-auto text-[11px] font-semibold text-blue-900">
                              Manual Doc: {ag.kyc.documentType} ({ag.kyc.documentNumber})
                              {ag.kyc.idPhotoUrl ? <> · <a href={ag.kyc.idPhotoUrl} target="_blank" rel="noreferrer" className="underline">ID Photo ↗</a></> : null}
                              {ag.kyc.selfiePhotoUrl ? <> · <a href={ag.kyc.selfiePhotoUrl} target="_blank" rel="noreferrer" className="underline">Selfie ↗</a></> : null}
                            </span>
                          )}
                        </div>
                        <ol className="relative ml-2 border-l-2 border-slate-200 pl-4 space-y-2.5">
                          {(ag.kycPipeline || []).map((st) => (
                            <li key={st.id} className="relative">
                              <span className={`absolute -left-[23px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${st.state === "done" ? "bg-emerald-600" : st.state === "failed" ? "bg-red-600" : st.state === "current" ? "bg-blue-600" : "bg-slate-300"}`}>
                                {st.state === "done" ? "✓" : st.state === "failed" ? "!" : "•"}
                              </span>
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className={`font-bold ${st.state === "done" ? "text-emerald-900" : st.state === "failed" ? "text-red-700" : st.state === "current" ? "text-blue-900" : "text-slate-500"}`}>{st.title}</span>
                                {st.at ? <span className="font-mono text-[10px] text-text-muted">{new Date(st.at).toLocaleString("en-IN")}</span> : null}
                              </div>
                              {st.detail ? <p className="text-[11px] text-text-muted">{st.detail}</p> : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))
                  )}
                </div>
                <h2 className="text-sm font-bold text-text-primary">Hub Employees &amp; Roles ({activeHub?.executives?.length || 0})</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  <TextInput placeholder="Executive Name" value={execName} onChange={(e) => setExecName(e.target.value)} />
                  <TextInput placeholder="Email / Staff ID" value={execEmail} onChange={(e) => setExecEmail(e.target.value)} />
                  <TextInput placeholder="Phone" value={execPhone} onChange={(e) => setExecPhone(e.target.value)} />
                  <SelectInput value={execRole} onChange={(e) => setExecRole(e.target.value)}>
                    <option value="hub_manager">Hub Manager</option>
                    <option value="inward_operator">Inward Operator</option>
                    <option value="sorting_operator">Sorting Operator</option>
                    <option value="bagging_operator">Bagging Operator</option>
                    <option value="dispatch_operator">Dispatch Operator</option>
                    <option value="transfer_coordinator">Transfer Coordinator</option>
                    <option value="last_mile_supervisor">Last-Mile Supervisor</option>
                    <option value="security_staff">Security Staff</option>
                    <option value="pickup_executive">Pickup Executive</option>
                    <option value="delivery_executive">Delivery Executive</option>
                  </SelectInput>
                  <TextInput placeholder="Shift" value={execShift} onChange={(e) => setExecShift(e.target.value)} />
                  <TextInput placeholder="Station" value={execStation} onChange={(e) => setExecStation(e.target.value)} />
                  <TextInput type="password" placeholder="Hub Login Password / PIN (for /hub/login)" value={execPassword} onChange={(e) => setExecPassword(e.target.value)} />
                </div>
                <Button disabled={busy || !execName.trim() || !execEmail.trim()} onClick={async () => {
                  const res = await act({ action: "add-executive", name: execName, email: execEmail, phone: execPhone, role: execRole, shift: execShift, station: execStation, password: execPassword });
                  if (res) { setExecName(""); setExecEmail(""); setExecPhone(""); setExecPassword(""); }
                }}>Add Hub Executive</Button>
                <div className="space-y-1.5 pt-2">
                  {(activeHub?.executives || []).map((ex: { id: string; name: string; email: string; role: string; shift?: string; station?: string }) => (
                    <div key={ex.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-xs">
                      <div>
                        <p className="font-bold">{ex.name} <span className="font-normal text-text-muted">({ex.role.replace(/_/g, " ")})</span></p>
                        <p className="text-text-muted">{ex.email} · {ex.shift || "Day"} · {ex.station || "Hub"}</p>
                      </div>
                      <button type="button" className="text-red-600 font-semibold" onClick={() => void act({ action: "remove-executive", execId: ex.id })}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
                <h2 className="text-sm font-bold text-text-primary">Hub Gate Entry &amp; Exit Register</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  <TextInput placeholder="Vehicle No (MH12...)" value={gateVeh} onChange={(e) => setGateVeh(e.target.value)} />
                  <TextInput placeholder="Driver Name" value={gateDriver} onChange={(e) => setGateDriver(e.target.value)} />
                  <TextInput placeholder="Driver Mobile" value={gatePhone} onChange={(e) => setGatePhone(e.target.value)} />
                  <TextInput placeholder="Purpose (Hub Transfer / Pickup)" value={gatePurpose} onChange={(e) => setGatePurpose(e.target.value)} />
                  <TextInput placeholder="Bag Count" value={gateBags} onChange={(e) => setGateBags(e.target.value)} />
                  <Button disabled={busy || !gateVeh.trim() || !gateDriver.trim()} onClick={async () => {
                    const res = await act({ action: "gate-entry", vehicleNo: gateVeh, driverName: gateDriver, driverPhone: gatePhone, purpose: gatePurpose, bagCount: Number(gateBags || 0) });
                    if (res) { setGateVeh(""); setGateDriver(""); setGatePhone(""); }
                  }}>Log Gate Entry</Button>
                </div>
                <div className="space-y-1.5 pt-2">
                  {(data?.gateEntries || []).map((g: { id: string; vehicleNo: string; driverName: string; purpose: string; bagCount: number; entryAt: string; exitAt?: string }) => (
                    <div key={g.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-xs">
                      <div>
                        <p className="font-mono font-bold">{g.vehicleNo} · {g.driverName}</p>
                        <p className="text-text-muted">{g.purpose} · {g.bagCount} bags · In {new Date(g.entryAt).toLocaleTimeString("en-IN")}{g.exitAt ? ` · Out ${new Date(g.exitAt).toLocaleTimeString("en-IN")}` : ""}</p>
                      </div>
                      {!g.exitAt ? (
                        <Button variant="outline" disabled={busy} onClick={() => void act({ action: "gate-exit", entryId: g.id })}>Mark Exit</Button>
                      ) : (
                        <StatusBadge tone="emerald">Exited</StatusBadge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 11. REPORTS & AUDIT TRAIL */}
          {section === "reports" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-text-primary">Hub Operations Reports &amp; Full Audit Trail</h2>
                  <p className="text-xs text-text-muted">Download active hub shipments CSV/Excel or review every scan, bag reopen, transfer &amp; gate event.</p>
                </div>
                <Button onClick={exportCsv}>Export Excel / CSV</Button>
              </div>
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold">Recent Audit Log ({data?.auditLog?.length ?? 0})</h3>
                <div className="mt-2 max-h-96 space-y-1.5 overflow-y-auto text-xs">
                  {(data?.auditLog || []).map((a: { id: string; at: string; hubCode: string; action: string; ref: string; by: string; detail: string }) => (
                    <div key={a.id} className="flex flex-wrap gap-2 border-b border-border/50 pb-1">
                      <span className="font-mono text-text-muted">{new Date(a.at).toLocaleString("en-IN")}</span>
                      <span className="font-mono font-bold text-blue-800">{a.hubCode}</span>
                      <span className="font-bold">{a.action}</span>
                      <span className="font-mono">{a.ref}</span>
                      <span className="text-text-muted">— {a.detail} ({a.by})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
