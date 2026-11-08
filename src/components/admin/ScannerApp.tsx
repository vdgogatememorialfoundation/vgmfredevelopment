"use client";

import Link from "next/link";
import { PortalLogin } from "@/components/admin/PortalLogin";
import { PickPackDesk } from "@/components/admin/PickPackDesk";
import { useAuth } from "@/components/auth/AuthContext";
import { canOpen } from "@/lib/roles";

/** Stand-alone phone web app for store pickers and packers, with its own sign-in. */
export function ScannerApp({ mode }: { mode?: "pick" | "pack" }) {
  const { user, signOut } = useAuth();
  const allowed =
    user &&
    (user.role === "admin" ||
      user.role === "coadmin" ||
      (user.role === "staff" && (canOpen(user, "/admin/commerce/picker") || canOpen(user, "/admin/commerce/packer"))));
  if (!allowed) return <PortalLogin portal="scanner" />;
  return (
    <div className="mx-auto max-w-2xl px-3 py-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">VGMF store scanner</p>
          <h1 className="text-xl font-bold text-slate-900">{mode === "pick" ? "Picker" : mode === "pack" ? "Packer" : "Choose your job"}</h1>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/scanner/picker" className={`rounded-lg border px-3 py-1.5 ${mode === "pick" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}>Picker</Link>
          <Link href="/scanner/packer" className={`rounded-lg border px-3 py-1.5 ${mode === "pack" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}>Packer</Link>
          <button type="button" onClick={signOut} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700">Sign out</button>
        </nav>
      </header>
      {mode ? (
        <PickPackDesk mode={mode} cameraFirst />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/scanner/picker" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-slate-900">Picker</p>
            <p className="mt-1 text-sm text-slate-600">Accept assigned orders and scan each item off the shelf.</p>
          </Link>
          <Link href="/scanner/packer" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-slate-900">Packer</p>
            <p className="mt-1 text-sm text-slate-600">Scan the order QR and each item into the box to mark it ready for dispatch.</p>
          </Link>
        </div>
      )}
    </div>
  );
}
