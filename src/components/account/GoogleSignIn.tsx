"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { remoteAccountToUser, remoteGoogle, type RemoteAccount } from "@/lib/account-api";
import { findAccountByIdentifier, loginBlockReason, saveAccount } from "@/lib/auth";

const ERRORS: Record<string, string> = {
  unavailable: "Google sign-in is not set up yet. Please use email instead.",
  cancelled: "Google sign-in was cancelled.",
  expired: "Google sign-in expired. Please try again.",
  failed: "Google could not sign you in. Please try again.",
  unverified: "Your Google email is not verified. Please use email instead.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function GoogleSignIn({ next }: { next?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const ticket = params.get("google") || "";
  const [error, setError] = useState(ERRORS[params.get("google_error") || ""] || "");
  const [busy, setBusy] = useState(Boolean(ticket));
  const [details, setDetails] = useState<{ email: string; firstName: string; lastName: string } | null>(null);
  const [phone, setPhone] = useState("+91");
  const started = useRef(false);
  const target = next || params.get("next") || "";

  const finish = (data: Record<string, unknown>) => {
    const account = data.account as RemoteAccount | undefined;
    if (!account) throw new Error("Could not open your account. Please try again.");
    const local = findAccountByIdentifier(account.email);
    const blocked = loginBlockReason(local);
    if (blocked) throw new Error(blocked);
    const user = remoteAccountToUser(account, local ?? {});
    saveAccount(user);
    signIn(user);
    router.replace(target.startsWith("/") && !target.startsWith("//") ? target : "/account");
  };

  const submit = async (extra: Record<string, string> = {}) => {
    setBusy(true);
    setError("");
    try {
      const data = await remoteGoogle({ ticket, ...extra });
      if (data.needsDetails) {
        setDetails({ email: String(data.email), firstName: String(data.firstName || ""), lastName: String(data.lastName || "") });
        setBusy(false);
        return;
      }
      finish(data);
    } catch (problem) {
      setError((problem as Error).message);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ticket || started.current) return;
    started.current = true;
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket]);

  if (details) {
    return (
      <form
        className="mb-6 space-y-3 rounded-xl border border-border bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit({ phone: phone.replace(/[\s-]/g, ""), firstName: details.firstName, lastName: details.lastName });
        }}
      >
        <p className="text-sm text-text-primary">
          Signed in with Google as <b>{details.email}</b>. Add your details to create your Vaidya Gogate Memorial Foundation account.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input-field" required placeholder="First name" value={details.firstName} onChange={(event) => setDetails({ ...details, firstName: event.target.value })} />
          <input className="input-field" required placeholder="Last name" value={details.lastName} onChange={(event) => setDetails({ ...details, lastName: event.target.value })} />
        </div>
        <input className="input-field" required inputMode="tel" placeholder="Mobile number with country code, e.g. +919876543210" value={phone} onChange={(event) => setPhone(event.target.value)} />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>
    );
  }

  return (
    <div className="mb-6">
      <a
        href={`/api/auth/google${target ? `?next=${encodeURIComponent(target)}` : ""}`}
        aria-disabled={busy}
        className={`flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary shadow-sm transition hover:border-burgundy ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <GoogleMark />
        {busy ? "Signing you in with Google…" : "Continue with Google"}
      </a>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wider text-text-muted">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
