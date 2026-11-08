"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Field, Panel, TextInput } from "@/components/admin/AdminUI";
import { RatesTable } from "@/components/admin/SettingsDesks";
import { bookShipment, downloadLabel, downloadManifest, fetchCourierRates, listPickupLocations, type RateQuote } from "@/lib/shipping-client";
import { getIntegrations } from "@/lib/integrations";
import { generateOrderId, saveOrder } from "@/lib/store";
import type { DeliveryAddress, Order } from "@/types";

const EMPTY: DeliveryAddress = { fullName: "", phone: "", email: "", line1: "", city: "", state: "", pincode: "", country: "India", countryCode: "IN" };

type PickupRow = { nickname: string; city: string; pincode: string; phone?: string; address?: string };

/** Book a courier for a parcel that has no store order (samples, documents, replacements sent by hand). */
export function QuickShipment() {
  const [to, setTo] = useState<DeliveryAddress>(EMPTY);
  const [contents, setContents] = useState("");
  const [weight, setWeight] = useState("0.5");
  const [dims, setDims] = useState({ length: "25", breadth: "20", height: "5" });
  const [value, setValue] = useState("500");
  const [cod, setCod] = useState("0");
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [picked, setPicked] = useState<number | undefined>();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [pickupNick, setPickupNick] = useState("");
  const pickup = pickups.find((row) => row.nickname === pickupNick);

  useEffect(() => {
    let live = true;
    listPickupLocations()
      .then((result) => live && setPickups(result.locations ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const set = (patch: Partial<DeliveryAddress>) => {
    setTo((current) => ({ ...current, ...patch }));
    if (patch.pincode !== undefined) setQuote(null);
  };
  const weightKg = Math.max(0.05, Number(weight) || 0.5);
  const parcel = { length: Math.max(1, Number(dims.length) || 1), breadth: Math.max(1, Number(dims.breadth) || 1), height: Math.max(1, Number(dims.height) || 1) };
  const declared = Math.max(1, Number(value) || 1);
  const codAmount = Math.max(0, Number(cod) || 0);

  const loadRates = async () => {
    setError("");
    setNote("");
    if (!/^\d{6}$/.test(to.pincode)) return setError("Enter a 6-digit delivery pincode.");
    setBusy("rates");
    try {
      const result = await fetchCourierRates({ deliveryPincode: to.pincode, pickupPincode: pickup?.pincode, weightKg, declaredValue: declared, cod: codAmount > 0, dims: parcel });
      setQuote(result);
      setPicked(result.rates.length ? 0 : undefined);
      if (!result.rates.length) setError("No courier returned a rate for this pincode.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load rates.");
    } finally {
      setBusy("");
    }
  };

  const create = async () => {
    setError("");
    setNote("");
    const rate = picked !== undefined ? quote?.rates[picked] : undefined;
    if (!to.fullName.trim() || !to.phone.trim() || !to.line1.trim() || !to.city.trim() || !to.state.trim()) return setError("Fill in the recipient's name, phone and full address.");
    if (!rate) return setError("Show couriers & rates and pick one first.");
    setBusy("book");
    const order: Order = {
      id: generateOrderId(),
      userId: "",
      userEmail: to.email || undefined,
      date: new Date().toISOString(),
      items: [{ bookId: "direct-shipment", title: contents.trim() || "Parcel", quantity: 1, price: declared, currency: "INR" }],
      subtotal: codAmount || declared,
      discount: 0,
      gst: 0,
      shipping: 0,
      total: codAmount || declared,
      currency: "INR",
      paymentStatus: codAmount > 0 ? "Pending" : "Paid",
      paymentMethod: codAmount > 0 ? "Cash on delivery" : "Direct shipment",
      status: "Packed",
      deliveryMode: "delivery",
      deliveryAddress: to,
      weightKg,
      parcel: { ...parcel, boxes: 1, kind: "single", contents: contents.trim() || undefined },
      courierChoice: rate,
      channel: "shipment",
    } as Order;
    try {
      saveOrder(order);
      const result = await bookShipment(
        order.id,
        rate,
        pickup ? { nickname: pickup.nickname, city: pickup.city, pincode: pickup.pincode, ...(pickup.address ? { line1: pickup.address } : {}), ...(pickup.phone ? { phone: pickup.phone } : {}) } : undefined
      );
      setBooked(order.id);
      setShipmentId(result.shipment.id);
      setNote(result.message);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not create the shipment.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Quick shipment" description="Create a courier shipment without a store order. It is listed in Shipment Management with a reference ID.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Recipient name"><TextInput value={to.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
          <Field label="Phone"><TextInput value={to.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Email (optional)"><TextInput value={to.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></Field>
          <div className="sm:col-span-3">
            <Field label="Pickup from">
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={pickupNick} onChange={(e) => { setPickupNick(e.target.value); setQuote(null); }}>
                <option value="">Default pickup address · {[getIntegrations().shipping.pickup.city, getIntegrations().shipping.pickup.pincode].filter(Boolean).join(" ")}</option>
                {pickups.map((row) => (
                  <option key={row.nickname} value={row.nickname}>{row.nickname} · {[row.address, row.city, row.pincode].filter(Boolean).join(", ")}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2"><Field label="Address"><TextInput value={to.line1} onChange={(e) => set({ line1: e.target.value })} /></Field></div>
          <Field label="Landmark / line 2"><TextInput value={to.landmark ?? ""} onChange={(e) => set({ landmark: e.target.value })} /></Field>
          <Field label="City"><TextInput value={to.city} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label="State"><TextInput value={to.state} onChange={(e) => set({ state: e.target.value })} /></Field>
          <Field label="Pincode"><TextInput inputMode="numeric" value={to.pincode} onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></Field>
          <Field label="Contents"><TextInput value={contents} placeholder="e.g. Books, documents" onChange={(e) => setContents(e.target.value)} /></Field>
          <Field label="Weight (kg)"><TextInput type="number" value={weight} onChange={(e) => { setWeight(e.target.value); setQuote(null); }} /></Field>
          <Field label="Length (cm)"><TextInput type="number" value={dims.length} onChange={(e) => { setDims({ ...dims, length: e.target.value }); setQuote(null); }} /></Field>
          <Field label="Breadth (cm)"><TextInput type="number" value={dims.breadth} onChange={(e) => { setDims({ ...dims, breadth: e.target.value }); setQuote(null); }} /></Field>
          <Field label="Height (cm)"><TextInput type="number" value={dims.height} onChange={(e) => { setDims({ ...dims, height: e.target.value }); setQuote(null); }} /></Field>
          <Field label="Declared value (₹)"><TextInput type="number" value={value} onChange={(e) => { setValue(e.target.value); setQuote(null); }} /></Field>
          <Field label="Collect on delivery (₹, 0 = prepaid)"><TextInput type="number" value={cod} onChange={(e) => { setCod(e.target.value); setQuote(null); }} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadRates} disabled={busy === "rates"}>{busy === "rates" ? "Checking…" : "Show couriers & rates"}</Button>
          <Button onClick={create} disabled={busy === "book" || picked === undefined}>
            {busy === "book" ? "Booking…" : picked !== undefined && quote ? `Create shipment with ${quote.rates[picked]?.courierName}` : "Create shipment"}
          </Button>
        </div>
        {quote && <div className="mt-4"><RatesTable quote={quote} picked={picked} onPick={setPicked} /></div>}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {note && (
          <p className="mt-3 text-sm text-emerald-700">
            {note} Reference {booked}. <Link href="/admin/commerce/shipments" className="underline">Open Shipment Management</Link>
          </p>
        )}
        {shipmentId && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void downloadLabel(shipmentId).then(setNote).catch((problem) => setError(problem instanceof Error ? problem.message : "No label yet."))}>Download waybill / label</Button>
            <Button variant="outline" onClick={() => void downloadManifest(shipmentId).then(setNote).catch((problem) => setError(problem instanceof Error ? problem.message : "No manifest yet."))}>Download manifest</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
