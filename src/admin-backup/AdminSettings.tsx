"use client";

import { useState } from "react";
import {
  getSettings,
  saveSettings,
  setMaintenanceMode,
} from "@/lib/admin-store";
import type { SiteSettings } from "@/types";
import { Button, Field, Panel, TextArea, TextInput } from "@/components/admin/AdminUI";
import { classNames } from "@/lib/utils";

export function SettingsSection() {
  const [settings, setSettings] = useState<SiteSettings>(() => getSettings());
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<SiteSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const save = () => {
    saveSettings(settings);
    if (settings.maintenanceMode) setMaintenanceMode(true, settings.maintenanceMessage);
    else setMaintenanceMode(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Site & System Settings</h1>
          <p className="text-sm text-text-muted">
            Branding, maintenance mode, processing timeline, API keys, locations and couriers.
          </p>
        </div>
        <Button onClick={save}>{saved ? "Saved ✓" : "Save all settings"}</Button>
      </div>

      <Panel title="Branding & identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site name">
            <TextInput value={settings.siteName} onChange={(e) => update({ siteName: e.target.value })} />
          </Field>
          <Field label="Logo text">
            <TextInput value={settings.logoText} onChange={(e) => update({ logoText: e.target.value })} />
          </Field>
          <Field label="Tagline">
            <TextInput value={settings.tagline} onChange={(e) => update({ tagline: e.target.value })} />
          </Field>
          <Field label="Logo image URL">
            <TextInput value={settings.logoUrl ?? ""} onChange={(e) => update({ logoUrl: e.target.value })} placeholder="https://..." />
          </Field>
          <Field label="Support email">
            <TextInput value={settings.supportEmail} onChange={(e) => update({ supportEmail: e.target.value })} />
          </Field>
          <Field label="Support phone">
            <TextInput value={settings.supportPhone} onChange={(e) => update({ supportPhone: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <Panel title="Maintenance mode">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            onChange={(e) => update({ maintenanceMode: e.target.checked })}
            className="mt-0.5 h-5 w-5 accent-burgundy"
          />
          <span>
            <span className="font-semibold text-text-primary">Enable maintenance mode</span>
            <span className="block text-text-muted">
              Visitors see a maintenance page; admins can still access the site.
            </span>
          </span>
        </label>
        <div className="mt-3">
          <Field label="Maintenance message">
            <TextArea rows={2} value={settings.maintenanceMessage} onChange={(e) => update({ maintenanceMessage: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <Panel title="Order processing timeline" description="Auto-computes pack → pick → ship → deliver dates for every new order.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Days to pack">
            <TextInput type="number" value={settings.processing.daysToPack} onChange={(e) => update({ processing: { ...settings.processing, daysToPack: Number(e.target.value) } })} />
          </Field>
          <Field label="Days to courier pickup">
            <TextInput type="number" value={settings.processing.daysToPickup} onChange={(e) => update({ processing: { ...settings.processing, daysToPickup: Number(e.target.value) } })} />
          </Field>
          <Field label="Days in transit">
            <TextInput type="number" value={settings.processing.daysInTransit} onChange={(e) => update({ processing: { ...settings.processing, daysInTransit: Number(e.target.value) } })} />
          </Field>
        </div>
      </Panel>

      <Panel title="API keys" description="Gateways are simulated in this demo — keys are stored for integration.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Google Maps API key">
            <TextInput type="password" value={settings.apiKeys.googleMaps} onChange={(e) => update({ apiKeys: { ...settings.apiKeys, googleMaps: e.target.value } })} placeholder="AIza..." />
          </Field>
          <Field label="Shiprocket API key">
            <TextInput type="password" value={settings.apiKeys.shiprocket} onChange={(e) => update({ apiKeys: { ...settings.apiKeys, shiprocket: e.target.value } })} placeholder="Shiprocket token" />
          </Field>
          <Field label="Razorpay key id">
            <TextInput type="password" value={settings.apiKeys.razorpay} onChange={(e) => update({ apiKeys: { ...settings.apiKeys, razorpay: e.target.value } })} placeholder="rzp_live_..." />
          </Field>
          <Field label="ZeptoMail API token">
            <TextInput type="password" value={settings.apiKeys.zeptomail} onChange={(e) => update({ apiKeys: { ...settings.apiKeys, zeptomail: e.target.value } })} placeholder="ZeptoMail API key" />
          </Field>
        </div>
      </Panel>

      <Panel title="Fulfillment locations" description="Warehouse / pickup locations used for shipping and store pickup.">
        <div className="space-y-3">
          {settings.fulfillmentLocations.map((loc, index) => (
            <div key={loc.id} className={classNames("grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-3", !loc.active && "opacity-50")}>
              <Field label="Name">
                <TextInput value={loc.name} onChange={(e) => setLocation(index, "name", e.target.value)} />
              </Field>
              <Field label="City">
                <TextInput value={loc.city} onChange={(e) => setLocation(index, "city", e.target.value)} />
              </Field>
              <Field label="Pincode">
                <TextInput value={loc.pincode} onChange={(e) => setLocation(index, "pincode", e.target.value)} />
              </Field>
              <div className="sm:col-span-3">
                <Field label="Address">
                  <TextInput value={loc.address} onChange={(e) => setLocation(index, "address", e.target.value)} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <input type="checkbox" checked={loc.active} onChange={(e) => setLocation(index, "active", e.target.checked)} className="h-4 w-4 accent-burgundy" />
                Active
              </label>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button variant="outline" onClick={() => update({ fulfillmentLocations: [...settings.fulfillmentLocations, { id: `fl-${Date.now()}`, name: "New location", code: "NEW", address: "", city: "", state: "Maharashtra", pincode: "", phone: "", active: true }] })}>
            + Add location
          </Button>
        </div>
      </Panel>

      <Panel title="Pickup timeslots" description="Time windows for courier pickup scheduling.">
        <ul className="space-y-2">
          {settings.pickupTimeslots.map((slot) => (
            <li key={slot.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
              <span className="font-medium text-text-primary">{slot.label}</span>
              <span className="text-text-muted">{slot.from} – {slot.to}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Courier partners">
        <div className="flex flex-wrap gap-2">
          {settings.couriers.map((courier) => (
            <span key={courier} className="rounded-full bg-warm-cream px-3 py-1 text-xs font-semibold text-burgundy">
              {courier}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );

  function setLocation<T>(index: number, key: string, value: T) {
    setSettings((s) => ({
      ...s,
      fulfillmentLocations: s.fulfillmentLocations.map((loc, i) =>
        i === index ? { ...loc, [key]: value } : loc
      ),
    }));
  }
}