"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OtpForm from "@/components/account/OtpForm";
import { ForgotPasswordForm } from "@/components/account/PasswordResetForm";
import { useAuth } from "@/components/auth/AuthContext";
import { findAccountByIdentifier, loginBlockReason, setSession } from "@/lib/auth";

type Step = "identifier" | "otp" | "forgot" | "complete";

export default function SignInFlow() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const enterAccount = () => {
    const account = findAccountByIdentifier(identifier);
    if (!account || loginBlockReason(account)) return;
    setSession(account);
    signIn(account);
    const next = new URLSearchParams(window.location.search).get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      router.push(next);
      return;
    }
    setStep("complete");
  };

  const handleIdentifier = (event: React.FormEvent) => {
    event.preventDefault();
    const account = findAccountByIdentifier(identifier);
    if (!account) {
      setError(
        "No account found with these details. Please create an account first."
      );
      return;
    }
    const blocked = loginBlockReason(account);
    if (blocked) {
      setError(blocked);
      return;
    }
    if (password) {
      if (!account.password || account.password !== password) {
        setError("Incorrect password. Use forgot password or request an email code.");
        return;
      }
      setError("");
      enterAccount();
      return;
    }
    setError("");
    setStep("otp");
  };

  const handleOtp = () => {
    enterAccount();
  };

  if (step === "forgot") {
    return (
      <ForgotPasswordForm
        role="customer"
        onBack={() => setStep("identifier")}
        onComplete={(account) => {
          setSession(account);
          signIn(account);
          setStep("complete");
        }}
      />
    );
  }

  if (step === "complete") {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </div>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">
          Signed In
        </p>

        <h2 className="mt-2 text-xl font-semibold text-text-primary">
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

        <h2 className="text-xl font-semibold text-text-primary">
          Welcome back
        </h2>

        <p className="mt-3 text-sm leading-6 text-text-muted">
          Sign in with your password, or leave it blank to receive an email and WhatsApp code.
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
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="signin-password">
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input-field"
            placeholder="Optional if you prefer a one-time code"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full">
          {password ? "Sign in" : "Send Codes to Email & WhatsApp"}
        </button>
        <button type="button" className="w-full text-sm font-semibold text-burgundy" onClick={() => setStep("forgot")}>
          Forgot password?
        </button>
      </form>
    </div>
  );
}