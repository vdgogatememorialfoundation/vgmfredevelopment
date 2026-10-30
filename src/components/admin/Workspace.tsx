"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { getOrders } from "@/lib/store";
import { getNotifications } from "@/lib/notify";
import { getLiveEvents } from "@/lib/cms";
import { getSettings, getTickets } from "@/lib/admin-store";
import { getIntegrations } from "@/lib/integrations";
import { allStaffModules, firstPathFor, getRole, modulesFor } from "@/lib/roles";
import { adminNavigation } from "@/app/(portal)/admin/_config/navigation";
import { canOpen } from "@/lib/roles";

export function WorkspaceHome() {
  const { user } = useAuth();
  if (!user) return null;
  const orders = getOrders();
  const notifications = getNotifications();
  const settings = getSettings();
  const integrations = getIntegrations();
  const allowed = modulesFor(user);
  const isAdmin = allowed === "all";
  const role = isAdmin ? null : getRole(user.staffRoleId);

  const stats = [
    { label: "Orders", value: orders.length, hint: `${orders.filter((order) => order.paymentStatus === "Pending").length} awaiting payment` },
    { label: "To pack", value: orders.filter((order) => order.status === "Ordered" || order.status === "Accepted").length, hint: "accepted and not packed" },
    { label: "Events", value: getLiveEvents().length, hint: "on the public site" },
    { label: "Open tickets", value: getTickets().filter((ticket) => ticket.status === "Open" || ticket.status === "In Progress").length, hint: "support" },
    { label: "Failed messages", value: notifications.filter((item) => item.status === "Failed").length, hint: `${notifications.length} in the log` },
  ];

  const cards = adminNavigation
    .flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))
    .filter((item) => item.href !== "/admin" && item.href !== "/admin/notices" && canOpen(user, item.href));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-burgundy">Vaidya Gogate Memorial Foundation</p>
          <h1 className="mt-1 text-3xl font-semibold text-gray-900">
            {isAdmin ? "Admin dashboard" : `Welcome, ${user.firstName}`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            {isAdmin
              ? "Manage the website, events, orders, payments, staff and delivery."
              : `${role?.name} (${role?.category}). These are the modules your role can open.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className={settings.maintenanceMode ? "rounded-full bg-amber-50 px-3 py-1 text-amber-700" : "rounded-full bg-emerald-50 px-3 py-1 text-emerald-700"}>
            {settings.maintenanceMode ? "Maintenance on" : "Site live"}
          </span>
          <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-gray-700">Razorpay: {integrations.razorpay.mode}</span>
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Portals</h2>
          <p className="mt-1 text-sm text-gray-600">Admin can open every portal: staff, customer and public support.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin" className="rounded-lg bg-burgundy px-3 py-2 text-sm font-semibold text-white">Admin</Link>
            <Link href="/staff" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-gray-800">Staff</Link>
            <Link href="/account" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-gray-800">Customer</Link>
            <Link href="/admin/support/tickets" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-gray-800">Tickets</Link>
            <Link href="/admin/analytics" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-gray-800">Analytics</Link>
            <Link href="/admin/reports" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-gray-800">Reports</Link>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{stat.value}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.hint}</p>
            </div>
          ))}
        </div>
      )}

      {!isAdmin && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allStaffModules()
            .filter((moduleItem) => allowed.includes(moduleItem.id))
            .map((moduleItem) => (
              <Link key={moduleItem.id} href={firstPathFor(moduleItem.id)} className="rounded-2xl border border-[#E5E7EB] bg-white p-6 transition hover:shadow-md">
                <h2 className="text-lg font-semibold text-gray-900">{moduleItem.label}</h2>
                <p className="mt-4 text-sm font-medium text-burgundy">Open module →</p>
              </Link>
            ))}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">All screens you can open</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label + card.href} href={card.href} className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm transition hover:border-burgundy/40">
              <span className="block text-[11px] uppercase tracking-wider text-gray-400">{card.group}</span>
              <span className="font-medium text-gray-900">{card.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
