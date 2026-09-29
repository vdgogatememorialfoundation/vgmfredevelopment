"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, FileBadge2, HandCoins, Image as ImageIcon, Inbox, Package, ShoppingBag, Users } from "lucide-react";
import { api } from "@/components/portal/api";
import type { PortalAccount } from "@/components/portal/types";

interface Stats {
  counts: { collection: string; status: string; n: number }[];
  totals: { payments: number | null; donations: number | null; orders: number | null };
  roles: { role: string; n: number }[];
  activity: { actor: string; action: string; target: string; at: string }[];
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function PortalDashboard({ account, base, shortcuts }: { account: PortalAccount; base: string; shortcuts: { label: string; href: string; description: string }[] }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Stats>("/api/admin/stats").then(setStats).catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load stats."));
  }, []);

  const total = (collection: string, status?: string) =>
    stats?.counts.filter((c) => c.collection === collection && (!status || c.status === status)).reduce((s, c) => s + c.n, 0) ?? 0;
  const has = (collection: string) => stats?.counts.some((c) => c.collection === collection) ?? false;

  const cards = [
    { label: "Live events", value: total("events", "published"), icon: CalendarDays, tone: "bg-gold-light text-navy", show: has("events") },
    { label: "Registrations", value: total("event-registrations"), icon: Users, tone: "bg-peacock-light text-peacock", show: account.role === "admin" || has("event-registrations") },
    { label: "Orders", value: total("orders"), icon: ShoppingBag, tone: "bg-lotus-light text-lotus", show: account.role === "admin" || has("orders") },
    { label: "Products", value: total("products", "published"), icon: Package, tone: "bg-sage-light text-sage", show: has("products") },
    { label: "Certificates", value: total("certificates", "valid"), icon: FileBadge2, tone: "bg-burgundy/10 text-burgundy", show: has("certificates") },
    { label: "Banners live", value: total("banners", "published"), icon: ImageIcon, tone: "bg-gold-light text-navy", show: has("banners") },
    { label: "New enquiries", value: total("contact-enquiries", "New") + total("support-tickets", "Open"), icon: Inbox, tone: "bg-red-50 text-red-600", show: account.role === "admin" || has("contact-enquiries") || has("support-tickets") },
    { label: "Donations pledged", value: stats?.totals.donations != null ? inr(stats.totals.donations) : "—", icon: HandCoins, tone: "bg-sage-light text-sage", show: stats?.totals.donations != null },
  ].filter((c) => c.show);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-saffron p-6 text-white shadow-lg shadow-burgundy/20 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">नमस्ते · Welcome back</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{account.firstName} {account.lastName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/90">
          {account.role === "admin" ? "Everything you publish here appears on the website within seconds — events, banners, shop, certificates and more." : "Here are the modules the administrator has assigned to you."}
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><card.icon size={20} /></span>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{card.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold text-text-primary">{stats ? card.value : "…"}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Quick links</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {shortcuts.map((s) => (
              <Link key={s.href} href={s.href} className="group rounded-xl border border-border p-4 transition hover:-translate-y-0.5 hover:border-burgundy/40 hover:shadow-md">
                <p className="flex items-center justify-between font-semibold text-text-primary">{s.label}<ArrowRight size={16} className="text-burgundy transition group-hover:translate-x-1" /></p>
                <p className="mt-1 text-xs text-text-muted">{s.description}</p>
              </Link>
            ))}
            {shortcuts.length === 0 && <p className="text-sm text-text-muted">No modules assigned yet. Ask the administrator to grant access.</p>}
          </div>
        </div>
        <div className="space-y-6">
          {stats && stats.roles.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <h2 className="font-display text-xl font-semibold">Accounts</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {stats.roles.map((r) => (
                  <li key={r.role} className="flex justify-between capitalize"><span className="text-text-muted">{r.role}</span><span className="font-bold">{r.n}</span></li>
                ))}
              </ul>
              <Link href={`${base}/accounts`} className="mt-4 inline-flex text-sm font-semibold text-burgundy hover:underline">Manage accounts →</Link>
            </div>
          )}
          {stats && stats.activity.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Activity size={18} className="text-burgundy" /> Recent activity</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {stats.activity.map((a, i) => (
                  <li key={i} className="border-l-2 border-gold pl-3">
                    <p className="text-text-primary"><span className="font-semibold">{a.actor}</span> {a.action}</p>
                    <p className="truncate text-xs text-text-muted">{a.target} · {new Date(a.at).toLocaleString("en-IN")}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
