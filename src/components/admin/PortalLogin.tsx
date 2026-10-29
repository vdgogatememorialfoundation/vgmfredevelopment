"use client";

import SiteLogo from "@/components/common/SiteLogo";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { ensureAdminCredentials, getAccounts } from "@/lib/admin-store";
import { loginBlockReason } from "@/lib/auth";

export function PortalLogin({ portal }: { portal: "admin" | "staff" }) {
  const router = useRouter();
  const { user, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const label = portal === "admin" ? "Admin" : "Staff";
  const target = "/admin";
  const signedIn = user?.role === portal;

  if (signedIn && user) {
    return (
      <Card portal={portal}>
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          You are signed in as {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}{" "}
          ({user.email}).
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => router.push(target)} className="btn-primary">
            Open {label} portal
          </button>
          <button type="button" onClick={() => { signOut(); router.refresh(); }} className="btn-outline">
            Sign out
          </button>
        </div>
      </Card>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    ensureAdminCredentials();
    const account = getAccounts().find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (!account || account.role !== portal) {
      setError(`No ${label.toLowerCase()} account found for this email.`);
      return;
    }
    if (!account.password || account.password !== password) {
      setError("Incorrect password. Please try again.");
      return;
    }
    const blocked = loginBlockReason(account);
    if (blocked) {
      setError(blocked);
      return;
    }
    setError("");
    signIn(account);
    router.push(target);
  };

  return (
    <Card portal={portal}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${portal}-email`}>
            Email id
          </label>
          <input
            id={`${portal}-email`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="you@vaidyagogate.org"
            autoComplete="username"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${portal}-password`}>
            Password
          </label>
          <input
            id={`${portal}-password`}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full">
          Sign in to {label} portal
        </button>
      </form>

      <div className="mt-5 rounded-xl bg-warm-cream p-4 text-xs leading-5 text-text-muted">
        <p className="font-semibold text-text-primary">Demo credentials</p>
        <p>
          {portal === "admin" ? "admin@vaidyagogate.org" : "care@vaidyagogate.org"} · password{" "}
          {portal === "admin" ? "admin123" : "staff123"}
        </p>
      </div>

      <Link href="/" className="mt-6 block text-center text-sm font-medium text-text-muted transition hover:text-burgundy">
        ← Back to website
      </Link>
    </Card>
  );
}

function Card({
  portal,
  children,
}: {
  portal: "admin" | "staff";
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-cream/40 px-5">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
          <div className="flex justify-center">
            <SiteLogo size={56} />
          </div>
          <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-burgundy">
            {portal === "admin" ? "Admin console" : "Staff console"}
          </p>
          <h1 className="mt-1 text-center text-2xl font-bold text-text-primary">
            {portal === "admin" ? "Admin sign in" : "Staff sign in"}
          </h1>
          <p className="mt-2 text-center text-sm text-text-muted">
            Use your {portal === "admin" ? "administrator" : "staff"} email and password.
          </p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </main>
  );
}