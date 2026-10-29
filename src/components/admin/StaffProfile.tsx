"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { displayName, getAccounts, updateAccount } from "@/lib/admin-store";
import { ChangePasswordForm } from "@/components/account/PasswordResetForm";
import { recordActivity, currentActorEmail } from "@/lib/activity";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const primary = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const CARE = "care@vaidyagogate.org";

export function StaffProfile() {
  const { user, signIn } = useAuth();
  const live = user ? getAccounts().find((account) => account.email.toLowerCase() === user.email.toLowerCase()) ?? user : null;
  const [draft, setDraft] = useState({
    firstName: live?.firstName ?? "",
    lastName: live?.lastName ?? "",
    phone: live?.phone ?? "",
    email: live?.email ?? "",
    replyTo: live?.replyToEmail || CARE,
  });
  const [note, setNote] = useState("");

  if (!live || live.role !== "staff") {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-sm text-slate-500">Sign in as staff to edit this profile.</p>
        <Link href="/staff" className="btn-primary mt-4">Staff sign in</Link>
      </div>
    );
  }

  const save = () => {
    if (!draft.firstName.trim() || !draft.email.trim() || !draft.phone.trim()) {
      setNote("Name, email and phone are required.");
      return;
    }
    updateAccount(live.email, {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      phone: draft.phone.trim(),
      whatsapp: draft.phone.trim(),
      email: draft.email.trim(),
      replyToEmail: draft.replyTo.trim() || CARE,
    });
    recordActivity({ email: draft.email.trim(), kind: "updated", by: currentActorEmail(), detail: "Staff profile updated" });
    const next = getAccounts().find((account) => account.email.toLowerCase() === draft.email.trim().toLowerCase());
    if (next) signIn(next);
    setNote("Profile saved. Replies to mail you send will go to " + (draft.replyTo.trim() || CARE) + ".");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-burgundy">Staff portal</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">My profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          {displayName(live)}. Update your details. When you send mail, replies go to the address you choose below.
        </p>
      </div>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <input className={field} placeholder="First name" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />
        <input className={field} placeholder="Last name" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />
        <input className={field} placeholder="Email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        <input className={field} placeholder="Phone" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Reply-to for emails you send</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={draft.replyTo === CARE} onChange={() => setDraft({ ...draft, replyTo: CARE })} />
            {CARE}
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="radio" checked={draft.replyTo === draft.email} onChange={() => setDraft({ ...draft, replyTo: draft.email })} />
            My profile email ({draft.email || "set email above"})
          </label>
        </fieldset>
        <div className="sm:col-span-2 flex flex-wrap gap-3">
          <button type="button" className={primary} onClick={save}>Save profile</button>
          <Link href="/staff" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Back to workspace</Link>
        </div>
        {note && <p className="sm:col-span-2 text-sm text-emerald-700">{note}</p>}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Reset password</h2>
        <p className="mt-1 text-sm text-slate-500">Staff can set a new password here without waiting on an administrator.</p>
        <div className="mt-4">
          <ChangePasswordForm email={live.email} />
        </div>
      </div>
    </div>
  );
}
