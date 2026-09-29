"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { getOrders } from "@/lib/store";
import { getLiveBooks } from "@/lib/product-data";
import {
  ensureBootstrapped,
  getOutbox,
  getSellers,
  getSettings,
  getSupportMessages,
  getTickets,
} from "@/lib/admin-store";
import { formatINR, StatCard } from "@/components/admin/AdminUI";
import { OrdersDashboard } from "@/components/admin/AdminOrders";
import { ShipmentsSection } from "@/components/admin/AdminShipments";
import { ProductsSection } from "@/components/admin/AdminProducts";
import { SellersSection } from "@/components/admin/AdminSellers";
import { AccountsSection } from "@/components/admin/AdminAccounts";
import { EmailSection, SupportSection } from "@/components/admin/AdminSupport";
import { SettingsSection } from "@/components/admin/AdminSettings";
import { classNames } from "@/lib/utils";
import type { User } from "@/types";

ensureBootstrapped();

export type AdminRole = "admin" | "staff";

const STAFF_SECTIONS = ["dashboard", "orders", "shipments", "support", "accounts"] as const;

export function AdminConsole({ role = "admin" }: { role?: AdminRole }) {
  const router = useRouter();
  const { user } = useAuth();
  const [section, setSection] = useState<string>("dashboard");

  if (!user) {
    return (
      <GatePrompt
        title={`${role === "admin" ? "Admin" : "Staff"} panel`}
        note={`Sign in with your ${role === "admin" ? "admin" : "staff"} email and password.`}
        onLogin={() => router.push(`/${role}/login`)}
        actionLabel="Go to sign in"
      />
    );
  }

  if (!(user.role === role)) {
    if (user.role === "admin") {
      return <GatePrompt title="Staff only" note="This area is for staff accounts. You have admin access — use /admin." onLogin={() => router.replace("/admin")} actionLabel="Open admin console" />;
    }
    return (
      <GatePrompt
        title="Access restricted"
        note="Please sign in with an admin or staff account to open this panel."
        onLogin={() => router.push(`/${role}/login`)}
        actionLabel="Go to sign in"
      />
    );
  }

  const sections =
    role === "admin"
      ? ["dashboard", "orders", "shipments", "products", "sellers", "accounts", "support", "email", "settings"]
      : [...STAFF_SECTIONS];

  return (
    <div className="container max-w-[1400px] py-8">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
              {role === "admin" ? "Admin Console" : "Staff Console"}
            </p>
            <nav className="space-y-0.5">
              {sections.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSection(s)}
                  className={classNames(
                    "block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold capitalize transition",
                    section === s ? "bg-burgundy text-white" : "text-text-muted hover:bg-warm-cream hover:text-burgundy"
                  )}
                >
                  {s}
                </button>
              ))}
            </nav>
            <div className="mt-4 border-t border-border pt-3">
              <Link href="/" className="block text-sm font-semibold text-burgundy hover:underline">← Back to website</Link>
              {user.role === "staff" && (
                <Link href="/admin" className="mt-1 block text-sm font-semibold text-burgundy hover:underline">Admin console</Link>
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          {section === "dashboard" && <Dashboard role={role} user={user} />}
          {section === "orders" && <OrdersDashboard />}
          {section === "shipments" && <ShipmentsSection />}
          {section === "products" && <ProductsSection />}
          {section === "sellers" && <SellersSection />}
          {section === "accounts" && <AccountsSection />}
          {section === "support" && <SupportSection />}
          {section === "email" && <EmailSection />}
          {section === "settings" && <SettingsSection />}
        </main>
      </div>
    </div>
  );
}

function Dashboard({ user, role }: { user: User; role: AdminRole }) {
  const orders = getOrders();
  const revenue = orders.filter((o) => o.status !== "Cancelled").reduce((sum, o) => sum + o.total, 0);
  const settings = getSettings();
  const counts = {
    live: getLiveBooks().length,
    orders: orders.length,
    pendingPickup: orders.filter((o) => o.status === "Ordered" || o.status === "Packed").length,
    shipped: orders.filter((o) => o.status === "Shipped").length,
    delivered: orders.filter((o) => o.status === "Delivered").length,
    sellers: getSellers().length,
    activeSellers: getSellers().filter((s) => s.status === "Active").length,
    tickets: getTickets().filter((t) => t.status === "Open" || t.status === "In Progress").length,
    queries: getSupportMessages().filter((m) => m.status === "New").length,
    emails: getOutbox().length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome, {user.firstName}
          </h1>
          <p className="text-sm text-text-muted">
            {role === "admin" ? "Full administration console." : "Orders, shipments and support."}
          </p>
        </div>
        <span
          className={classNames(
            "rounded-full px-3 py-1 text-xs font-bold",
            settings.maintenanceMode ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
          )}
        >
          {settings.maintenanceMode ? "Maintenance mode ON" : "Site live"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders" value={counts.orders} hint={`${counts.pendingPickup} pending pack/pickup`} />
        <StatCard label="Revenue" value={formatINR(revenue)} tone="emerald" hint="Non-cancelled orders" />
        <StatCard label="Products" value={counts.live} hint="in the live catalog" tone="sky" />
        <StatCard label="Sellers" value={`${counts.activeSellers}/${counts.sellers}`} hint="active / total" tone="amber" />
        <StatCard label="Shipments delivered" value={counts.delivered} tone="emerald" />
        <StatCard label="Open support" value={counts.queries + counts.tickets} hint={`${counts.queries} queries · ${counts.tickets} tickets`} tone="red" />
        <StatCard label="Emails sent" value={counts.emails} hint="via ZeptoMail (simulated)" tone="sky" />
        <StatCard label="Site name" value={settings.logoText} hint={settings.siteName} />
      </div>

      {settings.maintenanceMode && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Maintenance mode is ON — visitors see the maintenance page. You can turn it off in Settings.
        </div>
      )}
    </div>
  );
}

function GatePrompt({
  title,
  note,
  onLogin,
  actionLabel = "Go to sign in",
}: {
  title: string;
  note?: string;
  onLogin: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="container max-w-xl py-20 text-center">
      <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">{title}</p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary">Please sign in</h1>
        <p className="mt-2 text-sm text-text-muted">
          {note ?? "Use an account with the required role to open this panel."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={onLogin} className="btn-primary">{actionLabel}</button>
        </div>
      </div>
    </div>
  );
}