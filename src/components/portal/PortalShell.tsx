"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, KeyRound, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import Logo from "@/components/graphics/Logo";
import { ROLE_LABELS } from "@/lib/cms/modules";
import { api } from "@/components/portal/api";
import type { NavGroup, PortalAccount } from "@/components/portal/types";

export default function PortalShell({
  portal,
  account,
  navigation,
  children,
}: {
  portal: "admin" | "staff";
  account: PortalAccount | null;
  navigation: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const loginPath = `/${portal}/login`;

  if (pathname === loginPath) return <>{children}</>;

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero p-6 text-center">
        <div className="max-w-md rounded-3xl border border-border bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-semibold">Your session has ended</h1>
          <p className="mt-2 text-sm text-text-muted">Please sign in again to continue.</p>
          <Link href={loginPath} className="btn-primary mt-6">Go to sign in</Link>
        </div>
      </div>
    );
  }

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    signOut();
    router.replace(loginPath);
    router.refresh();
  };

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {navigation.map((group) => (
        <div key={group.label} className="mb-5">
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted/80">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const root = `/${portal}`;
              const active = pathname === item.href || (item.href !== root && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-xl px-3 py-2 text-sm transition ${active ? "bg-burgundy font-semibold text-white shadow-sm shadow-burgundy/30" : "text-text-primary/80 hover:bg-warm-cream hover:text-burgundy"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-border px-5 py-4">
      <Logo className="h-10 w-10" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-burgundy">VGMF</p>
        <p className="font-display text-lg font-semibold leading-tight text-text-primary">{portal === "admin" ? "Admin Console" : "Staff Portal"}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            {brand}
            {nav}
            <div className="border-t border-border p-4">
              <Link href="/" className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-burgundy hover:bg-warm-cream">
                <ExternalLink size={14} /> View website
              </Link>
            </div>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy/30" onClick={() => setOpen(false)} />
            <aside className="relative flex h-full w-72 flex-col bg-white shadow-xl">
              {brand}
              {nav}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
            <div className="bg-toran-stripe h-1" />
            <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-8">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-burgundy hover:bg-warm-cream lg:hidden" aria-label="Open menu"><Menu size={20} /></button>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{account.firstName} {account.lastName}</p>
                  <p className="text-xs text-text-muted">{ROLE_LABELS[account.role]} · {account.accountId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPwOpen(true)} className="btn-outline px-3 py-1.5 text-xs"><KeyRound size={14} /> <span className="hidden sm:inline">Password</span></button>
                <button type="button" onClick={() => void logout()} className="btn-outline px-3 py-1.5 text-xs"><LogOut size={14} /> <span className="hidden sm:inline">Sign out</span></button>
              </div>
            </div>
          </header>
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await api("/api/auth/password", { method: "POST", json: { current, next } });
      setMessage("Password updated.");
      setCurrent("");
      setNext("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/30 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Change password</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" className="input-field" autoComplete="current-password" />
          <input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (min 8 characters)" className="input-field" autoComplete="new-password" />
        </div>
        {message && <p className="mt-3 text-sm text-sage">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary mt-4 w-full justify-center">Update password</button>
      </form>
    </div>
  );
}
