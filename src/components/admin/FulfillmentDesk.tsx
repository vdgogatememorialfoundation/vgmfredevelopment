"use client";

import { useMemo, useState } from "react";
import { books } from "@/data/books";
import { getLiveBooks, updateStock } from "@/lib/product-data";
import {
  checkPincode,
  credentialsSaved,
  getCarriers,
  getPickupLocation,
  getPolicy,
  getProductFulfillment,
  saveCarrier,
  savePolicy,
  saveProductFulfillment,
  type CarrierAccount,
  type FulfillmentPolicy,
  type ProductFulfillment,
} from "@/lib/fulfillment";

function splitList(value: string) {
  return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
}

export function CarrierDesk({ mode = "partners" }: { mode?: "partners" | "apis" }) {
  const [carriers, setCarriers] = useState<CarrierAccount[]>(() => getCarriers());
  const [notice, setNotice] = useState("");

  const save = (carrier: CarrierAccount, message: string) => {
    saveCarrier(carrier);
    setCarriers(getCarriers());
    setNotice(message);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">Delivery partners</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          {mode === "apis" ? "Partner APIs" : "Courier partners"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Shiprocket, Nimbuspost, iThink Logistics, Tookan, Pidge, Shadowfax and the other
          networks used on the storefront. Enable a partner, save its credentials, and its
          serviceability and transit time are offered when a customer checks a pincode.
        </p>
      </div>

      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {carriers.map((carrier) => (
          <CarrierCard
            key={carrier.id}
            carrier={carrier}
            showSecrets={mode === "apis" || mode === "partners"}
            onChange={(next, message) => save(next, message)}
          />
        ))}
      </div>
    </div>
  );
}

function CarrierCard({
  carrier,
  showSecrets,
  onChange,
}: {
  carrier: CarrierAccount;
  showSecrets: boolean;
  onChange: (carrier: CarrierAccount, message: string) => void;
}) {
  const [draft, setDraft] = useState(carrier);
  const connected = credentialsSaved(draft);

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onChange(draft, `${draft.name} saved.`);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{draft.kind}</p>
          <h2 className="text-lg font-bold text-slate-900">{draft.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{draft.blurb}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          />
          Live
        </label>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {draft.prefixes.length ? `Pin prefixes ${draft.prefixes.join(", ")}` : "All standard postal zones"}
        {" · "}
        same-city {draft.sameCityDays === 0 ? "same day after dispatch" : `${draft.sameCityDays} business day transit`}
        {" · "}
        {connected ? "Credentials saved" : "Awaiting API credentials"}
      </p>

      {showSecrets && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">
            API key
            <input
              type="password"
              value={draft.apiKey}
              onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              placeholder="Partner API key"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            API secret
            <input
              type="password"
              value={draft.apiSecret}
              onChange={(event) => setDraft({ ...draft, apiSecret: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500 sm:col-span-2">
            Webhook URL
            <input
              value={draft.webhookUrl}
              onChange={(event) => setDraft({ ...draft, webhookUrl: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              placeholder="https://"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className="rounded-lg bg-[#651C1C] px-4 py-2 text-sm font-semibold text-white">
          Save {draft.name}
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          onClick={() => {
            if (!credentialsSaved(draft)) {
              onChange(draft, `Add the ${draft.name} API key (at least 8 characters) before marking it connected.`);
              return;
            }
            onChange(draft, `${draft.name} credentials accepted. Storefront ETAs use this partner’s zone SLA.`);
          }}
        >
          Test credentials
        </button>
      </div>
    </form>
  );
}

export function TimelineDesk() {
  const [policy, setPolicy] = useState<FulfillmentPolicy>(() => getPolicy());
  const [pincode, setPincode] = useState("411005");
  const [saved, setSaved] = useState(false);
  const preview = checkPincode(pincode, books[0]?.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">Settings</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Processing timelines</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          The product page adds these deadlines to the courier transit time. An order placed
          after the cutoff starts on the next business day. Sundays are skipped.
        </p>
      </div>

      <form
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          savePolicy(policy);
          setSaved(true);
        }}
      >
        <NumberField label="Order cutoff hour (0–23)" value={policy.orderCutoffHour} onChange={(orderCutoffHour) => setPolicy({ ...policy, orderCutoffHour })} />
        <NumberField label="Days to pack" value={policy.daysToPack} onChange={(daysToPack) => setPolicy({ ...policy, daysToPack })} />
        <NumberField label="Days until courier pickup" value={policy.daysToHandoff} onChange={(daysToHandoff) => setPolicy({ ...policy, daysToHandoff })} />
        <NumberField label="Fallback transit days" value={policy.defaultTransitDays} onChange={(defaultTransitDays) => setPolicy({ ...policy, defaultTransitDays })} />
        <NumberField label="Store pickup holding days" value={policy.pickupHoldingDays} onChange={(pickupHoldingDays) => setPolicy({ ...policy, pickupHoldingDays })} />
        <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={policy.storePickupEnabled}
            onChange={(event) => setPolicy({ ...policy, storePickupEnabled: event.target.checked })}
          />
          Pickup from store
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-lg bg-[#651C1C] px-4 py-2 text-sm font-semibold text-white">
            {saved ? "Timeline saved" : "Save timeline"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">Preview on the first catalogue product</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={pincode}
            onChange={(event) => {
              setPincode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setSaved(false);
            }}
            className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            inputMode="numeric"
            aria-label="Preview pincode"
          />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Ordered {preview.orderDate}. Pack by {preview.dispatchBy}.{" "}
          {preview.serviceable
            ? `${preview.courier} delivers ${preview.deliverBy} (${preview.transitDays} transit day${preview.transitDays === 1 ? "" : "s"}).`
            : preview.note}
        </p>
        {preview.pickupAvailable && (
          <p className="mt-1 text-sm text-slate-600">
            Pickup from store ready {preview.pickupReadyBy}, held until {preview.pickupHoldUntil}.
          </p>
        )}
      </div>
    </div>
  );
}

export function ShippingDesk() {
  const [policy, setPolicy] = useState<FulfillmentPolicy>(() => getPolicy());
  const [saved, setSaved] = useState(false);
  const location = getPickupLocation();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">Settings</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Shipping & store pickup</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Pickup from store is offered on the product page and at checkout when the product
          is in stock and the option is enabled here.
        </p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          savePolicy(policy);
          setSaved(true);
        }}
      >
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            checked={policy.storePickupEnabled}
            onChange={(event) => setPolicy({ ...policy, storePickupEnabled: event.target.checked })}
          />
          Offer pickup from store
        </label>
        <NumberField
          label="Days the packed order is held for collection"
          value={policy.pickupHoldingDays}
          onChange={(pickupHoldingDays) => setPolicy({ ...policy, pickupHoldingDays })}
        />
        <div className="rounded-xl bg-[#F8F1EA] p-4 text-sm text-slate-700">
          <p className="font-semibold">{location.name}</p>
          <p className="mt-1">{location.address}</p>
          <p className="mt-1">{location.phone}</p>
        </div>
        <button type="submit" className="rounded-lg bg-[#651C1C] px-4 py-2 text-sm font-semibold text-white">
          {saved ? "Shipping settings saved" : "Save shipping settings"}
        </button>
      </form>
    </div>
  );
}

export function InventoryDesk() {
  const [rows, setRows] = useState(() => loadInventory());
  const [notice, setNotice] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">Commerce</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Inventory & stocking</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          On-hand quantity, reorder level and the location that feeds delivery dates.
        </p>
      </div>
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Reorder</th>
              <th className="px-4 py-3">Stocking location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.book.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{row.book.title}</p>
                  <p className="text-xs text-slate-500">{row.book.sku}</p>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    value={row.stock}
                    onChange={(event) => updateRow(row.book.id, { stock: Number(event.target.value) })}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    value={row.profile.reorderLevel}
                    onChange={(event) =>
                      updateRow(row.book.id, {
                        profile: { ...row.profile, reorderLevel: Number(event.target.value) },
                      })
                    }
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    value={row.profile.stockingLocation}
                    onChange={(event) =>
                      updateRow(row.book.id, {
                        profile: { ...row.profile, stockingLocation: event.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5"
                  />
                </td>
                <td className="px-4 py-3">
                  <StockPill stock={row.stock} reorder={row.profile.reorderLevel} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="rounded-lg bg-[#651C1C] px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => {
                      updateStock(row.book.id, row.stock);
                      saveProductFulfillment(row.profile);
                      setNotice(`${row.book.title} inventory saved.`);
                    }}
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  function updateRow(bookId: string, patch: Partial<{ stock: number; profile: ProductFulfillment }>) {
    setRows((current) => current.map((row) => (row.book.id === bookId ? { ...row, ...patch } : row)));
  }
}

export function ProductServiceabilityDesk() {
  const catalog = useMemo(() => getLiveBooks(), []);
  const [bookId, setBookId] = useState(catalog[0]?.id ?? "");
  const [profile, setProfile] = useState<ProductFulfillment>(() =>
    getProductFulfillment(catalog[0]?.id ?? "")
  );
  const [prefixes, setPrefixes] = useState(profile.serviceablePrefixes.join(", "));
  const [blocked, setBlocked] = useState(profile.blockedPincodes.join(", "));
  const [pincode, setPincode] = useState("411005");
  const [notice, setNotice] = useState("");
  const carriers = getCarriers();
  const quote = checkPincode(pincode, bookId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">Commerce</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Product serviceability</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          For each product, choose home delivery, pickup from store, where it is stocked,
          which pin codes it serves, and which partner should be offered first. The storefront
          pincode check uses this together with the processing timeline.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          {catalog.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => {
                const next = getProductFulfillment(book.id);
                setBookId(book.id);
                setProfile(next);
                setPrefixes(next.serviceablePrefixes.join(", "));
                setBlocked(next.blockedPincodes.join(", "));
                setNotice("");
              }}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                book.id === bookId ? "bg-[#651C1C] text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {book.title}
            </button>
          ))}
        </div>

        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const next = {
              ...profile,
              bookId,
              serviceablePrefixes: splitList(prefixes),
              blockedPincodes: splitList(blocked),
            };
            saveProductFulfillment(next);
            setProfile(next);
            setNotice("Serviceability saved. The product page will use it on the next pincode check.");
          }}
        >
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={profile.deliveryEnabled}
              onChange={(event) => setProfile({ ...profile, deliveryEnabled: event.target.checked })}
            />
            Home delivery
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={profile.pickupEnabled}
              onChange={(event) => setProfile({ ...profile, pickupEnabled: event.target.checked })}
            />
            Pickup from store
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Stocking location
            <input
              value={profile.stockingLocation}
              onChange={(event) => setProfile({ ...profile, stockingLocation: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Extra processing days (blank uses the site timeline)
            <input
              type="number"
              min={0}
              value={profile.processingDays ?? ""}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  processingDays: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Serviceable pin prefixes (empty = all zones the partners cover)
            <input
              value={prefixes}
              onChange={(event) => setPrefixes(event.target.value)}
              placeholder="411, 400"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Blocked pincodes
            <input
              value={blocked}
              onChange={(event) => setBlocked(event.target.value)}
              placeholder="000000"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Preferred partner
            <select
              value={profile.preferredCarrierId}
              onChange={(event) => setProfile({ ...profile, preferredCarrierId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Fastest available</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-[#651C1C] px-4 py-2 text-sm font-semibold text-white">
            Save product delivery
          </button>
          {notice && <p className="text-sm text-emerald-700">{notice}</p>}

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer preview</p>
            <input
              value={pincode}
              onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-2 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              aria-label="Preview pincode"
            />
            <p className="mt-2 text-sm text-slate-700">
              {quote.serviceable
                ? `Deliver by ${quote.deliverBy} via ${quote.courier}. Packed ${quote.dispatchBy}.`
                : quote.note}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {quote.pickupAvailable
                ? `Pickup from store ready ${quote.pickupReadyBy} at ${quote.stockingLocation}.`
                : "Pickup from store is not offered for this check."}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function loadInventory() {
  return getLiveBooks().map((book) => ({
    book,
    stock: book.stock,
    profile: getProductFulfillment(book.id),
  }));
}

function StockPill({ stock, reorder }: { stock: number; reorder: number }) {
  if (stock <= 0) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">Out</span>;
  if (stock <= reorder) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Reorder</span>;
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">In stock</span>;
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-500">
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
      />
    </label>
  );
}
