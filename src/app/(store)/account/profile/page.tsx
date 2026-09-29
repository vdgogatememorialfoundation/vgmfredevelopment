"use client";

import { useState } from "react";
import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    whatsapp: user?.whatsapp ?? "",
  });

  if (!user) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <SectionHeader
        title="Edit Profile"
        description="Update your personal details and contact preferences."
      />

      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-border bg-white p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-first">
              First Name
            </label>
            <input
              id="profile-first"
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-last">
              Last Name
            </label>
            <input
              id="profile-last"
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-5">
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

        <div className="mt-5">
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-email">
            Email Address
          </label>
          <input
            id="profile-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input-field"
          />
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="profile-phone">
              Phone Number
            </label>
            <input
              id="profile-phone"
              type="tel"
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
        </div>

        <div className="mt-7 flex items-center gap-4">
          <button type="submit" className="btn-primary">
            Save Changes
          </button>
          {saved && (
            <span className="text-sm font-semibold text-emerald-600">
              ✓ Profile updated
            </span>
          )}
        </div>
      </form>
    </div>
  );
}