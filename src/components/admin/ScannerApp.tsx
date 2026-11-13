"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PickPackDesk } from "@/components/admin/PickPackDesk";
import { useAuth } from "@/components/auth/AuthContext";
import { canOpen } from "@/lib/roles";
import { PortalShell } from "@/components/admin/PortalShell";

/** Stand-alone phone web app for store pickers and packers, with its own sign-in. */
export function ScannerApp({ mode }: { mode?: "pick" | "pack" }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const job = mode === "pick" ? "picker" : mode === "pack" ? "packer" : null;
  const allowed =
    user &&
    (user.role === "admin" ||
      user.role === "coadmin" ||
      (user.role === "staff" &&
        (job ? canOpen(user, `/admin/commerce/${job}`) : canOpen(user, "/admin/commerce/picker") || canOpen(user, "/admin/commerce/packer"))));
  const loginUrl = job ? `/${job}/login` : "/scanner/login";
  useEffect(() => {
    if (!allowed) router.replace(loginUrl);
  }, [allowed, loginUrl, router]);
  if (!allowed) return <p className="p-8 text-center text-sm text-slate-500">Opening sign in…</p>;
  const signOutNow = () => {
    signOut();
    router.replace(loginUrl);
  };
  return (
    <PortalShell
      eyebrow="VGMF store scanner"
      title={mode === "pick" ? "Picker" : mode === "pack" ? "Packer" : "Choose your job"}
      groups={[
        {
          items: [
            { label: "Picker", href: "/picker", active: mode === "pick" },
            { label: "Packer", href: "/packer", active: mode === "pack" },
            { label: "Sign out", onSelect: signOutNow },
          ],
        },
      ]}
      contentClassName="px-3 py-4 sm:px-5 lg:p-8"
      actions={<button type="button" onClick={signOutNow} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">Sign out</button>}
    >
    <div className="mx-auto max-w-2xl">
      {mode ? (
        <PickPackDesk mode={mode} cameraFirst />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/picker" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-slate-900">Picker</p>
            <p className="mt-1 text-sm text-slate-600">Accept assigned orders and scan each item off the shelf.</p>
          </Link>
          <Link href="/packer" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-slate-900">Packer</p>
            <p className="mt-1 text-sm text-slate-600">Scan the order QR and each item into the box to mark it ready for dispatch.</p>
          </Link>
        </div>
      )}
    </div>
    </PortalShell>
  );
}
