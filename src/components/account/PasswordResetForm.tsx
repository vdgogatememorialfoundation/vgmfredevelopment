"use client";

import { useState } from "react";
import { accountForReset, applyPasswordReset, changeAccountPassword, sendPasswordResetCode, type ResetRole } from "@/lib/password-reset";
import { getAccounts } from "@/lib/admin-store";
import { lookupPartnerAccount } from "@/lib/partner-hydrate";
import type { User } from "@/types";

type ForgotStep = "identify" | "code" | "password" | "done";

export function ForgotPasswordForm({
  role,
  onBack,
  onComplete,
}: {
  role: ResetRole;
  onBack?: () => void;
  onComplete?: (account: User) => void;
}) {
  const [step, setStep] = useState<ForgotStep>("identify");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [account, setAccount] = useState<User | null>(null);

  const sendCode = (target: User) => {
    sendPasswordResetCode(target, role);
    setAccount(target);
    setHint(`A code was sent to ${target.email}.`);
    setError("");
    setStep("code");
  };

  const submitIdentify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    await lookupPartnerAccount({ identifier });
    const found = accountForReset(identifier, role);
    if ("error" in found && found.error) {
      setError(found.error);
      return;
    }
    sendCode(found.account!);
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    if (!account) return;
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setStep("password");
  };

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!account) return;
    if (password !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    const invalid = applyPasswordReset(account.email, role, code, password);
    if (invalid) {
      setError(invalid);
      if (invalid.toLowerCase().includes("code")) setStep("code");
      return;
    }
    const next = getAccounts().find((item) => item.email.toLowerCase() === account.email.toLowerCase()) ?? { ...account, password };
    setError("");
    setStep("done");
    onComplete?.(next);
  };

  return (
    <div>
      {onBack && step !== "done" ? (
        <button type="button" onClick={onBack} className="mb-6 text-sm font-medium text-text-muted hover:text-burgundy">
          ← Back to sign in
        </button>
      ) : null}
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">Reset password</p>
      {step === "identify" ? (
        <form onSubmit={(event) => void submitIdentify(event)} className="space-y-5">
          <h2 className="text-xl font-semibold text-text-primary">Forgot your password?</h2>
          <p className="text-sm text-text-muted">
            Enter the email, phone or account ID. We will send a reset code for this Foundation website. Seminar, Autism and Fellowship passwords stay on those sites and cannot be used here.
          </p>
          <input
            className="input-field"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={role === "customer" ? "Email, phone or Account ID" : "Email"}
            required
            autoComplete="username"
          />
          {error ? <ErrorText text={error} /> : null}
          <button type="submit" className="btn-primary w-full">Send reset code</button>
        </form>
      ) : null}
      {step === "code" ? (
        <form onSubmit={submitCode} className="space-y-5">
          <h2 className="text-xl font-semibold text-text-primary">Enter the code</h2>
          <p className="text-sm text-text-muted">A 6-digit code was sent to the registered email.</p>
          <input
            className="input-field tracking-[0.3em]"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            required
            autoComplete="one-time-code"
          />
          {hint ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{hint}</p> : null}
          {error ? <ErrorText text={error} /> : null}
          <button type="submit" className="btn-primary w-full">Continue</button>
          <button type="button" className="w-full text-sm font-semibold text-burgundy" onClick={() => account && sendCode(account)}>
            Resend code
          </button>
        </form>
      ) : null}
      {step === "password" ? (
        <form onSubmit={submitPassword} className="space-y-5">
          <h2 className="text-xl font-semibold text-text-primary">Choose a new Foundation password</h2>
          <p className="text-sm text-text-muted">This password is only for this website. It does not change your Seminar, Autism or Fellowship login.</p>
          <input
            className="input-field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password (6+ characters)"
            required
            autoComplete="new-password"
          />
          <input
            className="input-field"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Confirm new password"
            required
            autoComplete="new-password"
          />
          {error ? <ErrorText text={error} /> : null}
          <button type="submit" className="btn-primary w-full">Save password</button>
        </form>
      ) : null}
      {step === "done" ? (
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">Password updated</p>
          <h2 className="mt-2 text-xl font-semibold text-text-primary">You can sign in with the new Foundation password.</h2>
          <p className="mt-2 text-sm text-text-muted">Your Seminar, Autism and Fellowship passwords are unchanged.</p>
          {onBack ? (
            <button type="button" className="btn-primary mt-6" onClick={onBack}>
              Return to sign in
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ChangePasswordForm({ email, onSaved }: { email: string; onSaved?: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (next !== confirm) {
      setError("The new passwords do not match.");
      setNote("");
      return;
    }
    const invalid = changeAccountPassword(email, current, next);
    if (invalid) {
      setError(invalid);
      setNote("");
      return;
    }
    setError("");
    setCurrent("");
    setNext("");
    setConfirm("");
    setNote("Password saved.");
    onSaved?.();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="current-password">
          Current password
        </label>
        <input
          id="current-password"
          className="input-field"
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          placeholder="Leave blank if you have not set one yet"
          autoComplete="current-password"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          className="input-field"
          type="password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          placeholder="At least 6 characters"
          required
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="confirm-password">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          className="input-field"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      {error ? <ErrorText text={error} /> : null}
      {note ? <p className="text-sm font-semibold text-emerald-700">{note}</p> : null}
      <button type="submit" className="btn-primary">
        Save password
      </button>
    </form>
  );
}

function ErrorText({ text }: { text: string }) {
  return <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{text}</p>;
}
