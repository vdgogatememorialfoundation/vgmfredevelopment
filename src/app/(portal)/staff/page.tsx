"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import ClientOnly from "@/components/common/ClientOnly";
import { PortalLogin } from "@/components/admin/PortalLogin";
import { adminNavigation } from "@/app/(portal)/admin/_config/navigation";
import { canOpen, firstPathFor, getRole, modulesFor, staffModules } from "@/lib/roles";

function StaffHome() {
  const { user, signOut } = useAuth();
  if (!user || user.role !== "staff") {
    return <PortalLogin portal="staff" />;
  }

  const allowed = modulesFor(user);
  const role = user.role === "staff" ? getRole(user.staffRoleId) : null;
  const cards = adminNavigation
    .flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))
    .filter((item) => item.href !== "/admin" && canOpen(user, item.href));

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-burgundy">Staff portal</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Welcome, {user.firstName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {`${role?.name} (${role?.category}). These are the modules assigned to your role.`}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <button type="button" className="text-slate-500 hover:text-burgundy" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>

      {user.role === "staff" && allowed !== "all" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staffModules
            .filter((moduleItem) => allowed.includes(moduleItem.id))
            .map((moduleItem) => (
              <Link key={moduleItem.id} href={firstPathFor(moduleItem.id)} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-burgundy/40">
                <h2 className="text-lg font-semibold text-slate-900">{moduleItem.label}</h2>
                <p className="mt-4 text-sm font-medium text-burgundy">Open module →</p>
              </Link>
            ))}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Screens you can open</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.label + card.href} href={card.href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-burgundy/40">
              <span className="block text-[11px] uppercase tracking-wider text-slate-400">{card.group}</span>
              <span className="font-medium text-slate-900">{card.label}</span>
            </Link>
          ))}
        </div>
      </div>
      <Link href="/" className="inline-block text-sm text-slate-500 hover:text-burgundy">← Back to website</Link>
    </div>
  );
}

export default function StaffPage() {
  return (
    <ClientOnly>
      <StaffHome />
    </ClientOnly>
  );
}
