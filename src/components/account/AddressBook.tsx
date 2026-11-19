"use client";

import { useState } from "react";
import { AddressFields, emptyDeliveryAddress } from "@/components/store/AddressFields";
import Glyph from "@/components/store/Glyph";
import { useAuth } from "@/components/auth/AuthContext";
import { formatAddressLine, isValidPhone, isValidPostal } from "@/lib/geo";
import { makeDefaultAddress, removeAddress, saveAddress, useSavedAddresses, type SavedAddress } from "@/lib/account-wallet";
import type { DeliveryAddress } from "@/types";

function blank(user: { firstName: string; lastName: string; email: string; phone: string }): DeliveryAddress {
  return emptyDeliveryAddress({
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    phone: user.phone,
  });
}

export default function AddressBook() {
  const { user } = useAuth();
  const addresses = useSavedAddresses(user?.email);
  const [draft, setDraft] = useState<DeliveryAddress | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!user) return null;

  const openNew = () => {
    setEditing(null);
    setDraft(blank(user));
    setError("");
  };

  const openEdit = (address: SavedAddress) => {
    setEditing(address.id);
    setDraft(address);
    setError("");
  };

  const save = () => {
    if (!draft) return;
    if (!draft.fullName.trim() || !draft.line1.trim() || !draft.city.trim() || !draft.state.trim()) {
      setError("Add the name, street, city and state.");
      return;
    }
    if (!isValidPhone(draft.phone)) {
      setError("Enter a phone number with the country code.");
      return;
    }
    if (!isValidPostal(draft.countryCode, draft.pincode)) {
      setError("Enter a valid postal code.");
      return;
    }
    saveAddress(user.email, { ...draft, id: editing || undefined });
    setDraft(null);
    setEditing(null);
    setError("");
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="heading-3">Addresses</h1>
          <p className="mt-2 max-w-xl text-sm text-text-muted">Save home and office addresses for shop delivery.</p>
        </div>
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={openNew}>
          <Glyph name="plus" className="h-4 w-4" />
          Add address
        </button>
      </div>

      {draft && (
        <div className="mb-5 rounded-2xl border border-border bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
            <Glyph name="address" className="h-4 w-4 text-burgundy" />
            {editing ? "Edit address" : "New address"}
          </div>
          <AddressFields value={draft} onChange={setDraft} idPrefix="account-address" />
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={save}>Save address</button>
            <button type="button" className="btn-outline" onClick={() => { setDraft(null); setEditing(null); setError(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !draft && (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warm-cream text-burgundy">
            <Glyph name="address" className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-semibold text-text-primary">No saved addresses</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">Add a home or office address. Checkout can use it the next time you order.</p>
          <button type="button" className="btn-primary mt-6 inline-flex items-center gap-2" onClick={openNew}>
            <Glyph name="plus" className="h-4 w-4" />
            Add address
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {addresses.map((address) => (
          <li key={address.id} className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-cream text-burgundy">
                <Glyph name={address.place === "office" ? "office" : "home"} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{address.place === "office" ? "Office" : "Home"}</p>
                  {address.isDefault && <span className="rounded-full bg-burgundy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-burgundy">Default</span>}
                </div>
                <p className="mt-1 text-sm font-medium text-text-primary">{address.fullName} · {address.phone}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {address.line1}{address.landmark ? `, ${address.landmark}` : ""}, {formatAddressLine(address)}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                  {!address.isDefault && (
                    <button type="button" className="text-burgundy" onClick={() => makeDefaultAddress(user.email, address.id)}>Make default</button>
                  )}
                  <button type="button" className="text-text-primary" onClick={() => openEdit(address)}>Edit</button>
                  <button type="button" className="inline-flex items-center gap-1 text-red-700" onClick={() => removeAddress(user.email, address.id)}>
                    <Glyph name="trash" className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
