"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/account/SectionHeader";
import { ChangePasswordForm } from "@/components/account/PasswordResetForm";
import { useAuth } from "@/components/auth/AuthContext";
import { updateAccount } from "@/lib/admin-store";
import { saveAddress, useSavedAddresses } from "@/lib/account-wallet";
import { isValidPhone, isValidPostal } from "@/lib/geo";

export default function ProfilePage() {
  const { user } = useAuth();
  const savedAddresses = useSavedAddresses(user?.email);
  const defaultAddress = savedAddresses.find((item) => item.isDefault) ?? savedAddresses[0];
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    salutation: "Dr.",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    whatsapp: user?.whatsapp ?? "",
    alternatePhone: user?.phone ?? "",
    line1: defaultAddress?.line1 ?? "",
    landmark: defaultAddress?.landmark ?? "",
    city: defaultAddress?.city ?? "",
    state: defaultAddress?.state || "Maharashtra",
    pincode: defaultAddress?.pincode ?? "",
    country: defaultAddress?.country || "India",
    countryCode: defaultAddress?.countryCode || "IN",
  });

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      firstName: prev.firstName || user.firstName || "",
      lastName: prev.lastName || user.lastName || "",
      email: prev.email || user.email || "",
      phone: prev.phone || user.phone || defaultAddress?.phone || "",
      whatsapp: prev.whatsapp || user.whatsapp || user.phone || defaultAddress?.phone || "",
      alternatePhone: prev.alternatePhone || defaultAddress?.altPhone || user.phone || "",
      line1: prev.line1 || defaultAddress?.line1 || "",
      landmark: prev.landmark || defaultAddress?.landmark || "",
      city: prev.city || defaultAddress?.city || "",
      state: prev.state || defaultAddress?.state || "Maharashtra",
      pincode: prev.pincode || defaultAddress?.pincode || "",
    }));
  }, [user, defaultAddress]);

  if (!user) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Please enter your first name and last name.");
      return;
    }
    if (!isValidPhone(form.phone.trim())) {
      setError("Please enter a valid mobile number (mandatory).");
      return;
    }
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !isValidPostal(form.countryCode, form.pincode.trim())) {
      setError("Please enter your full address, city, state and a valid 6-digit PIN code.");
      return;
    }

    updateAccount(user.email, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || form.phone.trim(),
      salutation: form.salutation,
      alternatePhone: form.alternatePhone.trim() || form.phone.trim(),
      line1: form.line1.trim(),
      landmark: form.landmark.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      country: form.country,
      countryCode: form.countryCode,
    });

    saveAddress(form.email.trim() || user.email, {
      id: defaultAddress?.id,
      fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      phone: form.phone.trim(),
      altPhone: form.alternatePhone.trim() || undefined,
      email: form.email.trim(),
      line1: form.line1.trim(),
      landmark: form.landmark.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      country: form.country || "India",
      countryCode: form.countryCode || "IN",
      place: defaultAddress?.place || "home",
    });

    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <SectionHeader
        title="Edit Customer Profile & Address"
        description="Update your personal details, mandatory mobile number, and default customer address."
      />

      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-border bg-white p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-salutation">
              Title / Salutation
            </label>
            <select
              id="profile-salutation"
              value={form.salutation}
              onChange={(e) => setForm({ ...form, salutation: e.target.value })}
              className="input-field"
            >
              <option value="Dr.">Dr.</option>
              <option value="Vd.">Vd.</option>
              <option value="Mr.">Mr.</option>
              <option value="Ms.">Ms.</option>
              <option value="Mrs.">Mrs.</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-first">
              First Name *
            </label>
            <input
              id="profile-first"
              type="text"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-last">
              Last Name *
            </label>
            <input
              id="profile-last"
              type="text"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-account">
              Account ID
            </label>
            <input
              id="profile-account"
              type="text"
              readOnly
              value={user.accountId ?? ""}
              className="input-field bg-warm-cream"
            />
            <p className="mt-1 text-xs text-text-muted">
              Your unique Account ID cannot be changed.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-email">
              Email Address *
            </label>
            <input
              id="profile-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-phone">
              Mobile Number *
            </label>
            <input
              id="profile-phone"
              type="tel"
              required
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-whatsapp">
              WhatsApp Number
            </label>
            <input
              id="profile-whatsapp"
              type="tel"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-alt-phone">
              Alternate Phone
            </label>
            <input
              id="profile-alt-phone"
              type="tel"
              value={form.alternatePhone}
              onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-7 border-t border-border pt-6">
          <h3 className="text-base font-semibold text-text-primary">Customer Address (Mandatory for Delivery & Store Pickup)</h3>
          <p className="mt-1 text-xs text-text-muted">Saved as your default billing and delivery address.</p>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-line1">
              House, Flat, Building, Street, Area *
            </label>
            <input
              id="profile-line1"
              type="text"
              required
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-landmark">
                Landmark (Optional)
              </label>
              <input
                id="profile-landmark"
                type="text"
                value={form.landmark}
                onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-pincode">
                PIN Code *
              </label>
              <input
                id="profile-pincode"
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-city">
                City / Town *
              </label>
              <input
                id="profile-city"
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-state">
                State *
              </label>
              <input
                id="profile-state"
                type="text"
                required
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center gap-4">
          <button type="submit" className="btn-primary">
            Save All Customer Information
          </button>
          {saved && (
            <span className="text-sm font-semibold text-emerald-600">
              ✓ Customer profile & address saved
            </span>
          )}
        </div>
      </form>

      <div className="mt-8 rounded-2xl border border-border bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-text-primary">Reset password</h2>
        <p className="mt-1 text-sm text-text-muted">Choose a new password for this account.</p>
        <div className="mt-5">
          <ChangePasswordForm email={user.email} />
        </div>
      </div>
    </div>
  );
}
