"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import Logo from "@/components/graphics/Logo";
import Toran from "@/components/graphics/Toran";
import { api } from "@/components/portal/api";
import type { PortalAccount } from "@/components/portal/types";

const COPY = {
  admin: { title: "Admin Console", note: "Sign in with your administrator account." },
  staff: { title: "Staff Portal", note: "Use the staff login created for you by the administrator." },
  seller: { title: "Seller Portal", note: "Use the seller login created for you by the Foundation." },
} as const;

export default function PortalSignIn({ portal }: { portal: keyof typeof COPY }) {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { account } = await api<{ account: PortalAccount }>("/api/auth/login", {
        method: "POST",
        json: { identifier, password, portal },
      });
      signIn({
        id: account.id,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        phone: account.phone,
        whatsapp: account.phone,
        accountId: account.accountId,
        role: account.role === "delivery" ? "customer" : account.role,
        sellerId: account.role === "seller" ? account.accountId : undefined,
      });
      const next = params.get("next");
      router.replace(next && next.startsWith(`/${portal}`) ? next : `/${portal}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hero p-5">
      <Toran className="absolute inset-x-0 top-0 h-10 w-full" />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-white/95 p-8 shadow-xl shadow-burgundy/10 backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-14 w-14" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-burgundy">Vaidya Gogate Memorial Foundation</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-text-primary">{COPY[portal].title}</h1>
          <p className="mt-2 text-sm text-text-muted">{COPY[portal].note}</p>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Email or Account ID</span>
            <span className="relative block">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" className="input-field pl-9" placeholder="you@vaidyagogate.org" />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Password</span>
            <span className="relative block">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="input-field pl-9" placeholder="••••••••" />
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-60">
            <ShieldCheck size={17} /> {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-text-muted">Accounts are created by the Foundation administrator. Forgot your password? Ask the admin to reset it.</p>
        <Link href="/" className="mt-4 block text-center text-xs font-semibold text-burgundy hover:underline">← Back to website</Link>
      </div>
    </div>
  );
}
