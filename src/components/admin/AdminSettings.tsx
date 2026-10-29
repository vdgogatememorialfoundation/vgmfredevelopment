"use client";

import { useState } from "react";
import { getSettings, saveSettings } from "@/lib/admin-store";
import type { SiteSettings } from "@/types";
import { Button, Field, Panel, TextInput } from "@/components/admin/AdminUI";
import { classNames } from "@/lib/utils";

export function SettingsSection() {
  const [settings, setSettings] = useState<SiteSettings>(() => getSettings());
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<SiteSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const save = () => {
    const { processing, fulfillmentLocations, pickupTimeslots } = settings;
    saveSettings({ ...getSettings(), processing, fulfillmentLocations, pickupTimeslots });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Locations & processing</h2>
          <p className="text-sm text-text-muted">
            Processing timeline, warehouse and store pickup locations, and pickup timeslots.
          </p>
        </div>
        <Button onClick={save}>{saved ? "Saved" : "Save locations"}</Button>
      </div>

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

      <Panel title="Pickup timeslots" description="Time windows for courier pickup scheduling. Edit the label and hours, or add another window.">
        <ul className="space-y-3">
          {settings.pickupTimeslots.map((slot, index) => (
            <li key={slot.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_7rem_7rem_auto] sm:items-end">
              <Field label="Label">
                <TextInput
                  value={slot.label}
                  onChange={(event) => setSlot(index, "label", event.target.value)}
                />
              </Field>
              <Field label="From">
                <TextInput
                  type="time"
                  value={slot.from}
                  onChange={(event) => setSlot(index, "from", event.target.value)}
                />
              </Field>
              <Field label="To">
                <TextInput
                  type="time"
                  value={slot.to}
                  onChange={(event) => setSlot(index, "to", event.target.value)}
                />
              </Field>
              <button
                type="button"
                className="mb-1 text-sm font-semibold text-red-600 disabled:opacity-40"
                disabled={settings.pickupTimeslots.length < 2}
                onClick={() => update({ pickupTimeslots: settings.pickupTimeslots.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button
            variant="outline"
            onClick={() =>
              update({
                pickupTimeslots: [
                  ...settings.pickupTimeslots,
                  { id: `ts-${Date.now()}`, label: "New window", from: "10:00", to: "12:00" },
                ],
              })
            }
          >
            + Add timeslot
          </Button>
        </div>
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

  function setSlot(index: number, key: "label" | "from" | "to", value: string) {
    setSettings((s) => ({
      ...s,
      pickupTimeslots: s.pickupTimeslots.map((slot, i) => (i === index ? { ...slot, [key]: value } : slot)),
    }));
  }
}