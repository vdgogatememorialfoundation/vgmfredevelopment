"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import ClientOnly from "@/components/common/ClientOnly";

function DoctorHome() {
  const { user, signOut } = useAuth();
  if (!user || user.role !== "doctor") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-white p-8 text-center">
          <h1 className="text-2xl font-semibold text-text-primary">Doctor workspace</h1>
          <p className="mt-2 text-sm text-text-muted">Sign in with the doctor account an administrator created for you.</p>
          <Link href="/doctor/login" className="btn-primary mt-6">Doctor sign in</Link>
        </div>
      </div>
    );
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
