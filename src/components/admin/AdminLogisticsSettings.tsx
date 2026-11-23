"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, SelectInput, TextInput } from "@/components/admin/AdminUI";
import type { LogisticsSettingsData } from "@/lib/server/vgmf-logistics-settings";

type TabId =
  | "general"
  | "awb"
  | "pickup"
  | "hubs"
  | "sorting"
  | "manifests"
  | "routes"
  | "fleet"
  | "partners"
  | "delivery"
  | "serviceability"
  | "finance"
  | "automation"
  | "emergency";

const NAV: { id: TabId; title: string; sub: string }[] = [
  { id: "general", title: "General Settings", sub: "Company · Timezone · Modes" },
  { id: "awb", title: "Shipment & AWB", sub: "12-Digit AWB · Label · Barcode" },
  { id: "pickup", title: "Pickup & Seller Alerts", sub: "Scan + 6-Digit OTP · SLA" },
  { id: "hubs", title: "Hub Network Rules", sub: "Inward/Outward · Cutoffs" },
  { id: "sorting", title: "Sorting & Bagging", sub: "Racks · Bag Limits · Seals" },
  { id: "manifests", title: "Manifest Settings", sub: "7 Prefixes · Immutability" },
  { id: "routes", title: "Inter-Hub Routes", sub: "Origin → Dest · Cutoffs" },
  { id: "fleet", title: "Fleet & Vehicles", sub: "Vehicles · Capacity · Drivers" },
  { id: "partners", title: "Delivery Partners", sub: "Hub Approval · Earnings" },
  { id: "delivery", title: "Last Mile & POD", sub: "6-Digit OTP · No Rider GPS" },
  { id: "serviceability", title: "Serviceability & Pincodes", sub: "Pincodes · Primary Hubs" },
  { id: "finance", title: "COD & Rate Cards", sub: "Zones · COD Limits · GST" },
  { id: "automation", title: "Automation & Alerts", sub: "Aging · Bag · Delay SLA" },
  { id: "emergency", title: "Emergency & Versions", sub: "Kill Switches · Restore" },
];

export default function AdminLogisticsSettings() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabId>(NAV.some((n) => n.id === urlTab) ? (urlTab as TabId) : "general");
  const [accTest, setAccTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [accTesting, setAccTesting] = useState(false);
  const [cfg, setCfg] = useState<LogisticsSettingsData | null>(null);
  const [history, setHistory] = useState<{ version: number; at: string; by: string; note: string }[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  // Quick-add subforms
  const [rCode, setRCode] = useState("");
  const [rOrig, setROrig] = useState("");
  const [rDest, setRDest] = useState("");
  const [rCut, setRCut] = useState("18:00");

  const [vReg, setVReg] = useState("");
  const [vCat, setVCat] = useState<"Delivery Van" | "Motorcycle" | "Mini Van" | "Truck">("Delivery Van");
  const [vCap, setVCap] = useState("500");

  const [pPin, setPPin] = useState("");
  const [pCity, setPCity] = useState("");
  const [pHub, setPHub] = useState("");

  const load = async () => {
    const r = await fetch("/api/admin/logistics-settings", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) {
      setCfg(j.current);
      setHistory(j.history || []);
      setUpdatedAt(j.updatedAt || "");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (note = "Saved from Logistics Settings") => {
    if (!cfg) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/logistics-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings: cfg, note }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Save failed.");
      setCfg(j.current);
      setHistory(j.history || []);
      setUpdatedAt(j.updatedAt || "");
      setMsg({ text: j.message || "Saved." });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Save failed.", err: true });
    } finally {
      setBusy(false);
    }
  };

  const restore = async (version: number) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/logistics-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore", version }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Restore failed.");
      setCfg(j.current);
      setHistory(j.history || []);
      setMsg({ text: j.message });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Restore failed.", err: true });
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) return <div className="p-8 text-sm text-text-muted">Loading VGMF Logistics Configuration…</div>;

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs">
      <span className="font-semibold text-text-primary">{label}</span>
      <input type="checkbox" className="h-4 w-4 accent-burgundy" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">VGMF Logistics Configuration</h1>
          <p className="text-xs text-text-muted">
            Central administration for Hubs, Delivery Partners, 12-Digit AWB, OTP, Bagging, Routes, Fleet, Pincodes &amp; Rate Cards.
            {updatedAt ? ` · Last updated ${new Date(updatedAt).toLocaleString("en-IN")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/commerce/hubs" className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-warm-cream">
            Open Hub Operations →
          </Link>
          <Link href="/admin/settings/shipping-apis" className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-warm-cream">
            External Courier APIs →
          </Link>
          <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save & Activate Settings"}</Button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl border px-4 py-2.5 text-sm font-medium ${msg.err ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-border bg-white p-2.5 shadow-sm h-fit space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={`w-full rounded-xl px-3 py-2 text-left transition ${tab === n.id ? "bg-burgundy text-white" : "hover:bg-warm-cream text-text-primary"}`}
            >
              <p className="text-xs font-bold">{n.title}</p>
              <p className={`text-[10.5px] ${tab === n.id ? "text-white/80" : "text-text-muted"}`}>{n.sub}</p>
            </button>
          ))}
        </aside>

        <main className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-4">
          {tab === "general" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">General Logistics Settings</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Company Name<TextInput value={cfg.general.companyName} onChange={(e) => setCfg({ ...cfg, general: { ...cfg.general, companyName: e.target.value } })} /></label>
                <label className="text-xs font-semibold">Brand Name<TextInput value={cfg.general.brandName} onChange={(e) => setCfg({ ...cfg, general: { ...cfg.general, brandName: e.target.value } })} /></label>
                <label className="text-xs font-semibold">Support Email<TextInput value={cfg.general.supportEmail} onChange={(e) => setCfg({ ...cfg, general: { ...cfg.general, supportEmail: e.target.value } })} /></label>
                <label className="text-xs font-semibold">Support Phone<TextInput value={cfg.general.supportPhone} onChange={(e) => setCfg({ ...cfg, general: { ...cfg.general, supportPhone: e.target.value } })} /></label>
                <label className="text-xs font-semibold">Default Pickup Hub Code<TextInput value={cfg.general.defaultPickupHub} onChange={(e) => setCfg({ ...cfg, general: { ...cfg.general, defaultPickupHub: e.target.value } })} /></label>
                <label className="text-xs font-semibold">Default Delivery Attempt Limit<TextInput type="number" value={String(cfg.general.defaultDeliveryAttempts)} onChange={(e) => setCfg({ ...cfg, general: { ...cfg.general, defaultDeliveryAttempts: Number(e.target.value || 3) } })} /></label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Enable Own VGMF Logistics" checked={cfg.general.ownLogisticsEnabled} onChange={(v) => setCfg({ ...cfg, general: { ...cfg.general, ownLogisticsEnabled: v } })} />
                <Toggle label="Enable Third-Party Couriers" checked={cfg.general.thirdPartyCourierEnabled} onChange={(v) => setCfg({ ...cfg, general: { ...cfg.general, thirdPartyCourierEnabled: v } })} />
                <Toggle label="Enable Multiple Hubs" checked={cfg.general.multiHubEnabled} onChange={(v) => setCfg({ ...cfg, general: { ...cfg.general, multiHubEnabled: v } })} />
                <Toggle label="Enable Inter-Hub Transfers" checked={cfg.general.interHubTransfersEnabled} onChange={(v) => setCfg({ ...cfg, general: { ...cfg.general, interHubTransfersEnabled: v } })} />
                <Toggle label="Enable Cash on Delivery (COD)" checked={cfg.general.codEnabled} onChange={(v) => setCfg({ ...cfg, general: { ...cfg.general, codEnabled: v } })} />
              </div>
            </div>
          )}

          {tab === "awb" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Shipment, 12-Digit AWB &amp; Label Configuration</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold">Forward AWB Prefix (2 digits)<TextInput value={cfg.awb.forwardPrefix} onChange={(e) => setCfg({ ...cfg, awb: { ...cfg.awb, forwardPrefix: e.target.value } })} /></label>
                <label className="text-xs font-semibold">Return AWB Prefix (2 digits)<TextInput value={cfg.awb.returnPrefix} onChange={(e) => setCfg({ ...cfg, awb: { ...cfg.awb, returnPrefix: e.target.value } })} /></label>
                <label className="text-xs font-semibold">Label Size<SelectInput value={cfg.awb.labelSize} onChange={(e) => setCfg({ ...cfg, awb: { ...cfg.awb, labelSize: e.target.value as "4x6" | "A4" } })}><option value="4x6">4×6 Thermal</option><option value="A4">A4 Sheet</option></SelectInput></label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Show Sender Phone on Label" checked={cfg.awb.showSenderPhone} onChange={(v) => setCfg({ ...cfg, awb: { ...cfg.awb, showSenderPhone: v } })} />
                <Toggle label="Show Receiver Phone on Label" checked={cfg.awb.showReceiverPhone} onChange={(v) => setCfg({ ...cfg, awb: { ...cfg.awb, showReceiverPhone: v } })} />
                <Toggle label="Show Order Number Barcode" checked={cfg.awb.showOrderNumber} onChange={(v) => setCfg({ ...cfg, awb: { ...cfg.awb, showOrderNumber: v } })} />
                <Toggle label="Show Return Address" checked={cfg.awb.showReturnAddress} onChange={(v) => setCfg({ ...cfg, awb: { ...cfg.awb, showReturnAddress: v } })} />
              </div>
            </div>
          )}

          {tab === "pickup" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">First-Mile Pickup &amp; Seller Notification Rules</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Mandatory Barcode Scan on Pickup" checked={cfg.pickup.requireBarcodeScan} onChange={(v) => setCfg({ ...cfg, pickup: { ...cfg.pickup, requireBarcodeScan: v } })} />
                <Toggle label="Mandatory 6-Digit Seller Pickup OTP" checked={cfg.pickup.require6DigitSellerOtp} onChange={(v) => setCfg({ ...cfg, pickup: { ...cfg.pickup, require6DigitSellerOtp: v } })} />
                <Toggle label="Pickup Photo Mandatory" checked={cfg.pickup.pickupPhotoRequired} onChange={(v) => setCfg({ ...cfg, pickup: { ...cfg.pickup, pickupPhotoRequired: v } })} />
                <Toggle label="Notify Seller: Out for Pickup" checked={cfg.pickup.sellerNotifyOutForPickup} onChange={(v) => setCfg({ ...cfg, pickup: { ...cfg.pickup, sellerNotifyOutForPickup: v } })} />
                <Toggle label="Notify Seller: Picked Up" checked={cfg.pickup.sellerNotifyPickedUp} onChange={(v) => setCfg({ ...cfg, pickup: { ...cfg.pickup, sellerNotifyPickedUp: v } })} />
                <Toggle label="Notify Seller: Failed Attempt (NDR)" checked={cfg.pickup.sellerNotifyFailedAttempt} onChange={(v) => setCfg({ ...cfg, pickup: { ...cfg.pickup, sellerNotifyFailedAttempt: v } })} />
                <Toggle label="Notify Seller: In-Transit Updates (Recommended OFF)" checked={cfg.pickup.sellerNotifyInTransit} onChange={(v) => setCfg({ ...cfg, pickup: { ...cfg.pickup, sellerNotifyInTransit: v } })} />
              </div>
            </div>
          )}

          {tab === "hubs" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Hub Network Operational Policies</h2>
              <p className="text-xs text-text-muted">Create and manage individual hubs, types (Delivery &amp; Pickup / Warehouse / Sorting / Combined), executives, and agent approvals in <Link href="/admin/commerce/hubs" className="font-bold text-burgundy underline">Hub Operations</Link>.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Inward Scan Mandatory at Every Hub" checked={cfg.hubRules.inwardScanMandatory} onChange={(v) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, inwardScanMandatory: v } })} />
                <Toggle label="Outward Scan Mandatory Before Dispatch" checked={cfg.hubRules.outwardScanMandatory} onChange={(v) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, outwardScanMandatory: v } })} />
                <Toggle label="Bagging Mandatory for Inter-Hub Moves" checked={cfg.hubRules.baggingMandatory} onChange={(v) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, baggingMandatory: v } })} />
                <Toggle label="Manifest Required for Dispatch" checked={cfg.hubRules.manifestRequired} onChange={(v) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, manifestRequired: v } })} />
                <Toggle label="Wrong-Hub Rejection Alert" checked={cfg.hubRules.wrongHubRejection} onChange={(v) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, wrongHubRejection: v } })} />
                <Toggle label="Supervisor-Only Bag Reopen (Audit Logged)" checked={cfg.hubRules.supervisorBagReopenOnly} onChange={(v) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, supervisorBagReopenOnly: v } })} />
                <Toggle label="Automated Hub Code Generation" checked={cfg.hubRules.autoHubCode} onChange={(v) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, autoHubCode: v } })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Auto Hub Code Prefix<TextInput value={cfg.hubRules.hubCodePrefix || "VGMF"} onChange={(e) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, hubCodePrefix: e.target.value.toUpperCase() } })} /></label>
                <label className="text-xs font-semibold">Google Maps Geocoding API Key<TextInput type="password" placeholder="AIza..." value={cfg.hubRules.googleMapsApiKey || ""} onChange={(e) => setCfg({ ...cfg, hubRules: { ...cfg.hubRules, googleMapsApiKey: e.target.value } })} /></label>
              </div>
            </div>
          )}

          {tab === "sorting" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Sorting Racks &amp; Bagging Rules</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold">Bag Prefix<TextInput value={cfg.sortingBagging.bagPrefix} onChange={(e) => setCfg({ ...cfg, sortingBagging: { ...cfg.sortingBagging, bagPrefix: e.target.value.toUpperCase() } })} /></label>
                <label className="text-xs font-semibold">Max Parcels / Bag<TextInput type="number" value={String(cfg.sortingBagging.maxParcelsPerBag)} onChange={(e) => setCfg({ ...cfg, sortingBagging: { ...cfg.sortingBagging, maxParcelsPerBag: Number(e.target.value || 40) } })} /></label>
                <label className="text-xs font-semibold">Max Bag Weight (kg)<TextInput type="number" value={String(cfg.sortingBagging.maxBagWeightKg)} onChange={(e) => setCfg({ ...cfg, sortingBagging: { ...cfg.sortingBagging, maxBagWeightKg: Number(e.target.value || 25) } })} /></label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Physical Tamper Seal Mandatory" checked={cfg.sortingBagging.sealMandatory} onChange={(v) => setCfg({ ...cfg, sortingBagging: { ...cfg.sortingBagging, sealMandatory: v } })} />
                <Toggle label="Allow Mixed COD &amp; Prepaid in Same Bag" checked={cfg.sortingBagging.allowMixedCodPrepaidBag} onChange={(v) => setCfg({ ...cfg, sortingBagging: { ...cfg.sortingBagging, allowMixedCodPrepaidBag: v } })} />
              </div>
            </div>
          )}

          {tab === "manifests" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Manifest Prefixes &amp; Controls</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold">Pickup Prefix<TextInput value={cfg.manifests.pickupPrefix} onChange={(e) => setCfg({ ...cfg, manifests: { ...cfg.manifests, pickupPrefix: e.target.value.toUpperCase() } })} /></label>
                <label className="text-xs font-semibold">Inward Prefix<TextInput value={cfg.manifests.inwardPrefix} onChange={(e) => setCfg({ ...cfg, manifests: { ...cfg.manifests, inwardPrefix: e.target.value.toUpperCase() } })} /></label>
                <label className="text-xs font-semibold">Bag Prefix<TextInput value={cfg.manifests.bagPrefix} onChange={(e) => setCfg({ ...cfg, manifests: { ...cfg.manifests, bagPrefix: e.target.value.toUpperCase() } })} /></label>
                <label className="text-xs font-semibold">Transfer Prefix<TextInput value={cfg.manifests.transferPrefix} onChange={(e) => setCfg({ ...cfg, manifests: { ...cfg.manifests, transferPrefix: e.target.value.toUpperCase() } })} /></label>
                <label className="text-xs font-semibold">Delivery Prefix<TextInput value={cfg.manifests.deliveryPrefix} onChange={(e) => setCfg({ ...cfg, manifests: { ...cfg.manifests, deliveryPrefix: e.target.value.toUpperCase() } })} /></label>
                <label className="text-xs font-semibold">Return Prefix<TextInput value={cfg.manifests.returnPrefix} onChange={(e) => setCfg({ ...cfg, manifests: { ...cfg.manifests, returnPrefix: e.target.value.toUpperCase() } })} /></label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Immutable Once Dispatched" checked={cfg.manifests.immutableOnceDispatched} onChange={(v) => setCfg({ ...cfg, manifests: { ...cfg.manifests, immutableOnceDispatched: v } })} />
                <Toggle label="Require Digital Signature on Handover" checked={cfg.manifests.requireDigitalSignature} onChange={(v) => setCfg({ ...cfg, manifests: { ...cfg.manifests, requireDigitalSignature: v } })} />
              </div>
            </div>
          )}

          {tab === "routes" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Inter-Hub Routes ({cfg.routes.length})</h2>
              <div className="grid gap-2 sm:grid-cols-5">
                <TextInput placeholder="Route Code (RT-01)" value={rCode} onChange={(e) => setRCode(e.target.value)} />
                <TextInput placeholder="Origin Hub Code" value={rOrig} onChange={(e) => setROrig(e.target.value)} />
                <TextInput placeholder="Dest Hub Code" value={rDest} onChange={(e) => setRDest(e.target.value)} />
                <TextInput placeholder="Cutoff (18:00)" value={rCut} onChange={(e) => setRCut(e.target.value)} />
                <Button onClick={() => {
                  if (!rCode.trim() || !rOrig.trim() || !rDest.trim()) return;
                  setCfg({ ...cfg, routes: [...cfg.routes, { code: rCode.toUpperCase(), originHub: rOrig.toUpperCase(), destHub: rDest.toUpperCase(), transitHours: 12, dispatchCutoff: rCut || "18:00", operatingDays: "Mon–Sat", transportType: "Road", active: true }] });
                  setRCode(""); setROrig(""); setRDest("");
                }}>Add Route</Button>
              </div>
              <div className="space-y-1.5 text-xs">
                {cfg.routes.map((r) => (
                  <div key={r.code} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                    <span><b className="font-mono">{r.code}</b> · {r.originHub} → {r.destHub} · Cutoff {r.dispatchCutoff}</span>
                    <button type="button" className="text-red-600 font-semibold" onClick={() => setCfg({ ...cfg, routes: cfg.routes.filter((x) => x.code !== r.code) })}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "fleet" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Fleet &amp; Vehicles ({cfg.vehicles.length})</h2>
              <div className="grid gap-2 sm:grid-cols-4">
                <TextInput placeholder="Vehicle Reg (MH12AB1234)" value={vReg} onChange={(e) => setVReg(e.target.value)} />
                <SelectInput value={vCat} onChange={(e) => setVCat(e.target.value as "Delivery Van" | "Motorcycle" | "Mini Van" | "Truck")}>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Mini Van">Mini Van</option>
                  <option value="Delivery Van">Delivery Van</option>
                  <option value="Truck">Truck</option>
                </SelectInput>
                <TextInput type="number" placeholder="Capacity kg" value={vCap} onChange={(e) => setVCap(e.target.value)} />
                <Button onClick={() => {
                  if (!vReg.trim()) return;
                  setCfg({ ...cfg, vehicles: [...cfg.vehicles, { id: `veh-${Date.now()}`, regNo: vReg.toUpperCase(), category: vCat, capacityKg: Number(vCap || 500), maxParcels: 100, available: true }] });
                  setVReg("");
                }}>Add Vehicle</Button>
              </div>
              <div className="space-y-1.5 text-xs">
                {cfg.vehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                    <span><b className="font-mono">{v.regNo}</b> · {v.category} · {v.capacityKg} kg</span>
                    <button type="button" className="text-red-600 font-semibold" onClick={() => setCfg({ ...cfg, vehicles: cfg.vehicles.filter((x) => x.id !== v.id) })}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "partners" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Delivery Partner Onboarding, KYC &amp; Earnings</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Require Hub Selection on Agent Sign-Up" checked={cfg.partners.requireHubSelectionOnSignup} onChange={(v) => setCfg({ ...cfg, partners: { ...cfg.partners, requireHubSelectionOnSignup: v } })} />
                <Toggle label="Require Hub Manager Approval Before Activating ID" checked={cfg.partners.requireHubManagerApproval} onChange={(v) => setCfg({ ...cfg, partners: { ...cfg.partners, requireHubManagerApproval: v } })} />
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-emerald-950">Delivery Partner KYC Providers (Admin Control)</h3>
                  <p className="text-xs text-emerald-900/80">
                    Choose which KYC verification method(s) are enabled in the VGMF Delivery Partner app. Disabled providers are hidden from agents.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle
                    label="Enable Manual KYC (ID + Selfie + Admin Review)"
                    checked={cfg.kycProviders?.manualEnabled !== false}
                    onChange={(v) => setCfg({ ...cfg, kycProviders: { ...(cfg.kycProviders || { manualEnabled: true, accuraScanEnabled: true, defaultProvider: "manual", mandatoryBeforeActivation: true }), manualEnabled: v } })}
                  />
                  <Toggle
                    label="Enable AccuraScan AI KYC (docs.accurascan.com OCR + Face + Liveness)"
                    checked={cfg.kycProviders?.accuraScanEnabled !== false}
                    onChange={(v) => setCfg({ ...cfg, kycProviders: { ...(cfg.kycProviders || { manualEnabled: true, accuraScanEnabled: true, defaultProvider: "manual", mandatoryBeforeActivation: true }), accuraScanEnabled: v } })}
                  />
                  <Toggle
                    label="Require KYC Approved Before Hub Manager Activation"
                    checked={cfg.kycProviders?.mandatoryBeforeActivation !== false}
                    onChange={(v) => setCfg({ ...cfg, kycProviders: { ...(cfg.kycProviders || { manualEnabled: true, accuraScanEnabled: true, defaultProvider: "manual", mandatoryBeforeActivation: true }), mandatoryBeforeActivation: v } })}
                  />
                </div>
                <div className="max-w-xs">
                  <label className="text-xs font-semibold">
                    Default KYC Provider in Delivery App
                    <SelectInput
                      value={cfg.kycProviders?.defaultProvider || "manual"}
                      onChange={(e) => setCfg({ ...cfg, kycProviders: { ...(cfg.kycProviders || { manualEnabled: true, accuraScanEnabled: true, defaultProvider: "manual", mandatoryBeforeActivation: true }), defaultProvider: e.target.value as "manual" | "accurascan" } })}
                    >
                      <option value="manual">Manual KYC (Admin Review)</option>
                      <option value="accurascan">AccuraScan AI KYC (OCR + Face Match + Liveness)</option>
                    </SelectInput>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-indigo-950">AccuraScan KYC Configuration (docs.accurascan.com)</h3>
                  <p className="text-xs text-indigo-900/80">
                    Uses AccuraScan REST APIs: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">/api/v4/ocr</code>, <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">/v2/api/liveness</code>, and <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">/v2/api/facematch</code> with <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">Api-Key</code> authentication.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={accTesting}
                    onClick={async () => {
                      setAccTesting(true);
                      setAccTest(null);
                      try {
                        const r = await fetch("/api/admin/logistics-settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test-accurascan", apiKey: cfg.accuraScan?.apiKey || "" }) });
                        setAccTest(await r.json());
                      } catch {
                        setAccTest({ ok: false, message: "Could not run the test." });
                      } finally {
                        setAccTesting(false);
                      }
                    }}
                    className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {accTesting ? "Testing…" : "Test AccuraScan key"}
                  </button>
                  {accTest ? <span className={`text-xs font-semibold ${accTest.ok ? "text-green-700" : "text-red-700"}`}>{accTest.message}</span> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold">
                    AccuraScan API Key (Api-Key)
                    <TextInput
                      type="password"
                      placeholder="Paste AccuraScan API Key"
                      value={cfg.accuraScan?.apiKey || ""}
                      onChange={(e) => setCfg({ ...cfg, accuraScan: { ...(cfg.accuraScan || { apiKey: "", apiBaseUrl: "https://api.accurascan.com", countryCode: "IND", minFaceMatchScore: 70, minLivenessScore: 55, autoApproveOnPass: true }), apiKey: e.target.value } })}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    API Base URL
                    <TextInput
                      placeholder="https://api.accurascan.com"
                      value={cfg.accuraScan?.apiBaseUrl || "https://api.accurascan.com"}
                      onChange={(e) => setCfg({ ...cfg, accuraScan: { ...(cfg.accuraScan || { apiKey: "", apiBaseUrl: "https://api.accurascan.com", countryCode: "IND", minFaceMatchScore: 70, minLivenessScore: 55, autoApproveOnPass: true }), apiBaseUrl: e.target.value } })}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Country Code (ISO3)
                    <TextInput
                      placeholder="IND"
                      value={cfg.accuraScan?.countryCode || "IND"}
                      onChange={(e) => setCfg({ ...cfg, accuraScan: { ...(cfg.accuraScan || { apiKey: "", apiBaseUrl: "https://api.accurascan.com", countryCode: "IND", minFaceMatchScore: 70, minLivenessScore: 55, autoApproveOnPass: true }), countryCode: e.target.value.toUpperCase() } })}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Min Face Match Score (%)
                    <TextInput
                      type="number"
                      value={String(cfg.accuraScan?.minFaceMatchScore ?? 70)}
                      onChange={(e) => setCfg({ ...cfg, accuraScan: { ...(cfg.accuraScan || { apiKey: "", apiBaseUrl: "https://api.accurascan.com", countryCode: "IND", minFaceMatchScore: 70, minLivenessScore: 55, autoApproveOnPass: true }), minFaceMatchScore: Number(e.target.value || 70) } })}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Min Liveness Score (%)
                    <TextInput
                      type="number"
                      value={String(cfg.accuraScan?.minLivenessScore ?? 55)}
                      onChange={(e) => setCfg({ ...cfg, accuraScan: { ...(cfg.accuraScan || { apiKey: "", apiBaseUrl: "https://api.accurascan.com", countryCode: "IND", minFaceMatchScore: 70, minLivenessScore: 55, autoApproveOnPass: true }), minLivenessScore: Number(e.target.value || 55) } })}
                    />
                  </label>
                </div>
                <Toggle
                  label="Auto-Approve Agent KYC when AccuraScan OCR, Face Match &amp; Liveness Pass Thresholds"
                  checked={cfg.accuraScan?.autoApproveOnPass !== false}
                  onChange={(v) => setCfg({ ...cfg, accuraScan: { ...(cfg.accuraScan || { apiKey: "", apiBaseUrl: "https://api.accurascan.com", countryCode: "IND", minFaceMatchScore: 70, minLivenessScore: 55, autoApproveOnPass: true }), autoApproveOnPass: v } })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <label className="text-xs font-semibold">Per Pickup (₹)<TextInput type="number" value={String(cfg.partners.earningsPerPickup)} onChange={(e) => setCfg({ ...cfg, partners: { ...cfg.partners, earningsPerPickup: Number(e.target.value || 0) } })} /></label>
                <label className="text-xs font-semibold">Per Delivery (₹)<TextInput type="number" value={String(cfg.partners.earningsPerDelivery)} onChange={(e) => setCfg({ ...cfg, partners: { ...cfg.partners, earningsPerDelivery: Number(e.target.value || 0) } })} /></label>
                <label className="text-xs font-semibold">Return Collection (₹)<TextInput type="number" value={String(cfg.partners.earningsReturnCollection)} onChange={(e) => setCfg({ ...cfg, partners: { ...cfg.partners, earningsReturnCollection: Number(e.target.value || 0) } })} /></label>
                <label className="text-xs font-semibold">Payout Cycle<SelectInput value={cfg.partners.payoutCycle} onChange={(e) => setCfg({ ...cfg, partners: { ...cfg.partners, payoutCycle: e.target.value as "Weekly" | "Monthly" } })}><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option></SelectInput></label>
              </div>
            </div>
          )}

          {tab === "delivery" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Last-Mile Delivery, Mandatory 6-Digit OTP &amp; Privacy</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Mandatory Barcode Scan Before Delivery" checked={cfg.delivery.requireBarcodeScan} onChange={(v) => setCfg({ ...cfg, delivery: { ...cfg.delivery, requireBarcodeScan: v } })} />
                <Toggle label="Mandatory 6-Digit Customer Delivery OTP" checked={cfg.delivery.require6DigitCustomerOtp} onChange={(v) => setCfg({ ...cfg, delivery: { ...cfg.delivery, require6DigitCustomerOtp: v } })} />
                <Toggle label="Hide Delivery Agent Live Location from Customer" checked={cfg.delivery.hideAgentLocationFromCustomer} onChange={(v) => setCfg({ ...cfg, delivery: { ...cfg.delivery, hideAgentLocationFromCustomer: v } })} />
                <Toggle label="Proof of Delivery (POD) Photo Mandatory" checked={cfg.delivery.podPhotoRequired} onChange={(v) => setCfg({ ...cfg, delivery: { ...cfg.delivery, podPhotoRequired: v } })} />
              </div>
            </div>
          )}

          {tab === "serviceability" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Serviceable Pincodes &amp; Hub Mapping ({cfg.pincodes.length})</h2>
              <div className="grid gap-2 sm:grid-cols-4">
                <TextInput placeholder="Pincode (e.g. 411030)" value={pPin} onChange={(e) => setPPin(e.target.value)} />
                <TextInput placeholder="City" value={pCity} onChange={(e) => setPCity(e.target.value)} />
                <TextInput placeholder="Assigned Hub Code" value={pHub} onChange={(e) => setPHub(e.target.value)} />
                <Button onClick={() => {
                  if (!pPin.trim()) return;
                  setCfg({ ...cfg, pincodes: [...cfg.pincodes, { pincode: pPin.trim(), city: pCity.trim(), state: "India", primaryHub: pHub.trim().toUpperCase(), zone: "Local", pickupEnabled: true, deliveryEnabled: true, codEnabled: true, ownLogistics: true, slaDays: 2 }] });
                  setPPin(""); setPCity("");
                }}>Add Pincode</Button>
              </div>
              <div className="space-y-1.5 text-xs">
                {cfg.pincodes.map((pc, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                    <span><b className="font-mono">{pc.pincode}</b> · {pc.city} · Hub <b className="font-mono">{pc.primaryHub || "—"}</b> · {pc.zone} ({pc.slaDays}d SLA)</span>
                    <button type="button" className="text-red-600 font-semibold" onClick={() => setCfg({ ...cfg, pincodes: cfg.pincodes.filter((_, i) => i !== idx) })}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "finance" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">COD Limits &amp; Own-Logistics Zone Rate Cards</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold">Max COD per Order (₹)<TextInput type="number" value={String(cfg.finance.maxCodAmount)} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, maxCodAmount: Number(e.target.value || 0) } })} /></label>
                <label className="text-xs font-semibold">Partner Cash Limit (₹)<TextInput type="number" value={String(cfg.finance.partnerCodLimit)} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, partnerCodLimit: Number(e.target.value || 0) } })} /></label>
                <label className="text-xs font-semibold">GST (%)<TextInput type="number" value={String(cfg.finance.gstPercent)} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, gstPercent: Number(e.target.value || 0) } })} /></label>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                <h3 className="text-sm font-extrabold text-blue-950">Paytm Offline Dynamic QR &amp; Razorpay Doorstep COD</h3>
                <p className="text-xs text-blue-900/80">
                  Razorpay uses your existing Razorpay keys from Admin → Settings → Payments. Configure Paytm Business Offline QR credentials below for instant doorstep COD QR + live status sync to Merchant Portal &amp; Customer.
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="text-xs font-semibold">Paytm MID<TextInput placeholder="Merchant ID" value={(cfg.finance as unknown as Record<string, string>).paytmMid || ""} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, paytmMid: e.target.value } as typeof cfg.finance })} /></label>
                  <label className="text-xs font-semibold">Paytm Merchant Key<TextInput type="password" placeholder="Merchant Key" value={(cfg.finance as unknown as Record<string, string>).paytmMerchantKey || ""} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, paytmMerchantKey: e.target.value } as typeof cfg.finance })} /></label>
                  <label className="text-xs font-semibold">Paytm POS ID<TextInput placeholder="VGMF_DELIVERY_POS" value={(cfg.finance as unknown as Record<string, string>).paytmPosId || ""} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, paytmPosId: e.target.value } as typeof cfg.finance })} /></label>
                  <label className="text-xs font-semibold">Paytm Business UPI ID (Fallback)<TextInput placeholder="merchant@paytm" value={(cfg.finance as unknown as Record<string, string>).paytmUpiId || ""} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, paytmUpiId: e.target.value } as typeof cfg.finance })} /></label>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-4 text-xs">
                {(["local", "regional", "national", "remote"] as const).map((z) => (
                  <div key={z} className="rounded-xl border border-border p-3 space-y-2">
                    <p className="font-extrabold uppercase">{z}</p>
                    <label className="block">Base ₹<TextInput type="number" value={String(cfg.finance.rateCard[z].base)} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, rateCard: { ...cfg.finance.rateCard, [z]: { ...cfg.finance.rateCard[z], base: Number(e.target.value || 0) } } } })} /></label>
                    <label className="block">Addl / kg ₹<TextInput type="number" value={String(cfg.finance.rateCard[z].perKg)} onChange={(e) => setCfg({ ...cfg, finance: { ...cfg.finance, rateCard: { ...cfg.finance.rateCard, [z]: { ...cfg.finance.rateCard[z], perKg: Number(e.target.value || 0) } } } })} /></label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "automation" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold">Automation &amp; SLA Alert Thresholds</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Shipment Aging Alert (Hours)<TextInput type="number" value={String(cfg.automation.agingAlertHours)} onChange={(e) => setCfg({ ...cfg, automation: { ...cfg.automation, agingAlertHours: Number(e.target.value || 48) } })} /></label>
                <label className="text-xs font-semibold">Bag Capacity Alert (%)<TextInput type="number" value={String(cfg.automation.bagCapacityAlertPercent)} onChange={(e) => setCfg({ ...cfg, automation: { ...cfg.automation, bagCapacityAlertPercent: Number(e.target.value || 85) } })} /></label>
                <label className="text-xs font-semibold">Transfer Delay Alert (Hours)<TextInput type="number" value={String(cfg.automation.transferDelayAlertHours)} onChange={(e) => setCfg({ ...cfg, automation: { ...cfg.automation, transferDelayAlertHours: Number(e.target.value || 24) } })} /></label>
                <label className="text-xs font-semibold">Failed Pickup Escalation (Minutes)<TextInput type="number" value={String(cfg.automation.failedPickupEscalationMinutes)} onChange={(e) => setCfg({ ...cfg, automation: { ...cfg.automation, failedPickupEscalationMinutes: Number(e.target.value || 120) } })} /></label>
              </div>
            </div>
          )}

          {tab === "emergency" && (
            <div className="space-y-4">
              <h2 className="text-base font-extrabold text-red-800">Emergency Operational Kill Switches</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Emergency Pause New Pickup Assignments" checked={cfg.emergency.pauseNewPickups} onChange={(v) => setCfg({ ...cfg, emergency: { ...cfg.emergency, pauseNewPickups: v } })} />
                <Toggle label="Pause Bag Dispatch" checked={cfg.emergency.pauseBagDispatch} onChange={(v) => setCfg({ ...cfg, emergency: { ...cfg.emergency, pauseBagDispatch: v } })} />
                <Toggle label="Pause Automatic Shipment Allocation" checked={cfg.emergency.pauseAutoAllocation} onChange={(v) => setCfg({ ...cfg, emergency: { ...cfg.emergency, pauseAutoAllocation: v } })} />
              </div>
              <label className="block text-xs font-semibold">Emergency Broadcast Banner<TextInput placeholder="Optional alert shown to all hubs & delivery partners" value={cfg.emergency.emergencyBanner} onChange={(e) => setCfg({ ...cfg, emergency: { ...cfg.emergency, emergencyBanner: e.target.value } })} /></label>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-bold">Configuration Version History ({history.length})</h3>
                <div className="mt-2 space-y-1.5 text-xs">
                  {history.map((h) => (
                    <div key={h.version} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                      <span><b>v{h.version}</b> · {new Date(h.at).toLocaleString("en-IN")} · {h.by} — {h.note}</span>
                      <Button variant="outline" disabled={busy} onClick={() => void restore(h.version)}>Restore v{h.version}</Button>
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
