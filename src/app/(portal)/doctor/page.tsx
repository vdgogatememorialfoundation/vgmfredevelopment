"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import ClientOnly from "@/components/common/ClientOnly";
import { PortalLogin } from "@/components/admin/PortalLogin";
import { ChangePasswordForm } from "@/components/account/PasswordResetForm";

function DoctorHome() {
  const { user, signOut } = useAuth();
  if (!user || user.role !== "doctor") {
    return <PortalLogin portal="doctor" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-burgundy">Doctor portal</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Welcome, {user.firstName}</h1>
          <p className="mt-1 text-sm text-slate-500">Update clinic pages and your public consulting details.</p>
        </div>
        <button type="button" className="text-sm text-slate-500 hover:text-burgundy" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Reset password</h2>
        <p className="mt-1 text-sm text-slate-500">Choose a new password for this doctor account.</p>
        <div className="mt-4">
          <ChangePasswordForm email={user.email} />
        </div>
      </div>
      <Link href="/admin/website/clinics" className="block rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-burgundy/40">
        <h2 className="text-lg font-semibold text-slate-900">Clinics</h2>
        <p className="mt-2 text-sm text-slate-500">Edit clinic hours, photos, doctors and directions shown on the website.</p>
        <p className="mt-4 text-sm font-medium text-burgundy">Open clinics →</p>
      </Link>
      <Link href="/" className="text-sm text-slate-500 hover:text-burgundy">← Back to website</Link>
    </div>
  );
}

export default function DoctorPage() {
  return (
    <ClientOnly>
      <DoctorHome />
    </ClientOnly>
  );
}
