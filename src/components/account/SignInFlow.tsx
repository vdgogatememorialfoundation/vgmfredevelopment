"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OtpForm from "@/components/account/OtpForm";
import { useAuth } from "@/components/auth/AuthContext";
import { findAccountByIdentifier, setSession } from "@/lib/auth";

type Step = "identifier" | "otp" | "complete";

export default function SignInFlow() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");

  const handleIdentifier = (event: React.FormEvent) => {
    event.preventDefault();
    const account = findAccountByIdentifier(identifier);
    if (!account) {
      setError(
        "No account found with these details. Please create an account first."
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

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full">
          Send Codes to Email & WhatsApp
        </button>
      </form>
    </div>
  );
}