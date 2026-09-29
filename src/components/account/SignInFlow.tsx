"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OtpForm from "@/components/account/OtpForm";
import { useAuth } from "@/components/auth/AuthContext";
import { findAccountByIdentifier, setSession } from "@/lib/auth";
import type { User } from "@/types";

type Step = "identifier" | "otp" | "complete";

export default function SignInFlow() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleIdentifier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password) {
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier, password, portal: "customer" }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          account?: { id: string; accountId: string; firstName: string; lastName: string; email: string; phone: string; role: User["role"] | "delivery" };
        };
        if (!res.ok || !body.account) {
          setError(body.error ?? "Could not sign in.");
          return;
        }
        const a = body.account;
        const user: User = {
          id: a.id,
          accountId: a.accountId,
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          phone: a.phone,
          whatsapp: a.phone,
          role: a.role === "delivery" ? "customer" : a.role,
        };
        setSession(user);
        signIn(user);
        setStep("complete");
      } finally {
        setBusy(false);
      }
      return;
    }
    const account = findAccountByIdentifier(identifier);
    if (!account) {
      setError(
        "No account found with these details. Enter the password issued by the Foundation office, or contact us for access."
      );
      return;
    }
    setError("");
    setStep("otp");
  };

  const handleOtp = () => {
    const account = findAccountByIdentifier(identifier);
    if (!account) return;

    setSession(account);
    signIn(account);
    setStep("complete");
  };

  if (step === "complete") {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </div>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">
          Signed In
        </p>

        <h2 className="mt-2 text-3xl font-bold text-text-primary">
          Welcome back
        </h2>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => router.push("/account")} className="btn-primary">
            Go to My Account
          </button>
          <button type="button" onClick={() => router.push("/")} className="btn-outline">
            Continue to Website
          </button>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <OtpForm
        title="Verify your identity"
        description={`We sent a verification code to your registered email and WhatsApp.`}
        onSubmit={handleOtp}
        onBack={() => setStep("identifier")}
        onResend={() => undefined}
      />
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">
          Sign In
        </p>

        <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
          Welcome back
        </h2>

        <p className="mt-3 text-sm leading-6 text-text-muted">
          Log in with your registered email, phone number or Account ID.
        </p>
      </div>

      <form onSubmit={handleIdentifier} className="space-y-5">
        <div>
          <label
            className="mb-2 block text-sm font-semibold text-text-primary"
            htmlFor="signin-identifier"
          >
            Email, Phone or Account ID
          </label>
          <input
            id="signin-identifier"
            type="text"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="input-field"
            placeholder="name@example.com / +91 98765 43210 / 12-digit Account ID"
            autoComplete="username"
          />
        </div>

        <div>
          <label
            className="mb-2 block text-sm font-semibold text-text-primary"
            htmlFor="signin-password"
          >
            Password <span className="font-normal text-text-muted">(accounts issued by the Foundation)</span>
          </label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input-field"
            placeholder="Leave blank to receive a one-time code"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "Signing in…" : password ? "Sign In" : "Send Codes to Email & WhatsApp"}
        </button>
      </form>
    </div>
  );
}