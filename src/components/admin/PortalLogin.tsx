"use client";

import SiteLogo from "@/components/common/SiteLogo";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { ensureAdminCredentials, getAccounts, sendEmail } from "@/lib/admin-store";
import { loginBlockReason } from "@/lib/auth";
import { issueEmailOtp, verifyEmailOtp } from "@/lib/otp";
import { ForgotPasswordForm } from "@/components/account/PasswordResetForm";

const copy = {
  admin: { label: "Admin", target: "/admin", hint: "administrator" },
  staff: { label: "Staff", target: "/staff", hint: "staff" },
  doctor: { label: "Doctor", target: "/doctor", hint: "doctor" },
} as const;

type Mode = "password" | "mfa" | "otp" | "forgot";

export function PortalLogin({ portal }: { portal: "admin" | "staff" | "doctor" }) {
  const router = useRouter();
  const { user, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<Mode>("password");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState("");
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const { label, target, hint } = copy[portal];
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

  const findPortalAccount = () => {
    ensureAdminCredentials();
    return getAccounts().find(
      (account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.role === portal
    );
  };

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    const account = findPortalAccount();
    if (!account) {
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
    const code = issueEmailOtp(account.email, portal);
    sendEmail({
      to: account.email,
      phone: account.phone,
      name: account.firstName,
      subject: `${label} verification code`,
      template: "custom",
      body: `Hi ${account.firstName},\n\nYour ${label.toLowerCase()} verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore the email.\n\n– VGMF`,
    });
    setPendingEmail(account.email);
    setOtpHint(`Password accepted. Code sent to ${account.email}. Demo code: ${code}`);
    setMode("mfa");
  };

  const sendCode = (event: React.FormEvent) => {
    event.preventDefault();
    const account = findPortalAccount();
    if (!account) {
      setError(`No ${label.toLowerCase()} account found for this email.`);
      return;
    }
    const blocked = loginBlockReason(account);
    if (blocked) {
      setError(blocked);
      return;
    }
    const code = issueEmailOtp(account.email, portal);
    sendEmail({
      to: account.email,
      phone: account.phone,
      name: account.firstName,
      subject: `${label} sign-in code`,
      template: "custom",
      body: `Hi ${account.firstName},\n\nYour ${label.toLowerCase()} sign-in code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore the email.\n\n– VGMF`,
    });
    setOtpSent(true);
    setOtpHint(`Code sent to ${account.email}. Demo code: ${code}`);
    setError("");
  };

  const submitOtp = (event: React.FormEvent) => {
    event.preventDefault();
    const account = findPortalAccount();
    if (!account) {
      setError(`No ${label.toLowerCase()} account found for this email.`);
      return;
    }
    const blocked = loginBlockReason(account);
    if (blocked) {
      setError(blocked);
      return;
    }
    const invalid = verifyEmailOtp(account.email, portal, otp);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    signIn(account);
    router.push(target);
  };

  const submitMfa = (event: React.FormEvent) => {
    event.preventDefault();
    const account = findPortalAccount();
    if (!account) {
      setError(`No ${label.toLowerCase()} account found for this email.`);
      return;
    }
    const blocked = loginBlockReason(account);
    if (blocked) {
      setError(blocked);
      return;
    }
    const invalid = verifyEmailOtp(account.email, portal, otp);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    signIn(account);
    router.push(target);
  };

  if (mode === "forgot") {
    return (
      <Card portal={portal}>
        <ForgotPasswordForm role={portal} onBack={() => { setMode("password"); setError(""); }} onComplete={(account) => { signIn(account); router.push(target); }} />
      </Card>
    );
  }

  return (
    <Card portal={portal}>
      {mode === "mfa" ? (
        <form onSubmit={submitMfa} className="space-y-5">
          <p className="text-sm text-text-muted">
            Multi-factor step for {pendingEmail || email}. Enter the code from email to finish signing in. The session then stays open until you log out.
          </p>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`${portal}-mfa`}>
              6-digit verification code
            </label>
            <input
              id={`${portal}-mfa`}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="input-field tracking-[0.3em]"
              placeholder="••••••"
              autoComplete="one-time-code"
            />
          </div>
          {otpHint && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{otpHint}</p>}
          {error && <ErrorText text={error} />}
          <button type="submit" className="btn-primary w-full">
            Verify and open portal
          </button>
          <button type="button" className="w-full text-sm font-semibold text-burgundy" onClick={() => { setMode("password"); setError(""); setOtp(""); }}>
            Back to password
          </button>
        </form>
      ) : mode === "password" || portal !== "staff" ? (
        <form onSubmit={submitPassword} className="space-y-5">
          <EmailField portal={portal} email={email} setEmail={setEmail} />
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
          {error && <ErrorText text={error} />}
          <button type="submit" className="btn-primary w-full">
            Sign in to {label} portal
          </button>
          <button type="button" className="w-full text-sm font-semibold text-burgundy" onClick={() => { setMode("forgot"); setError(""); }}>
            Forgot password?
          </button>
        </form>
      ) : (
        <form onSubmit={otpSent ? submitOtp : sendCode} className="space-y-5">
          <EmailField portal={portal} email={email} setEmail={setEmail} />
          {otpSent && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="staff-otp">
                6-digit code
              </label>
              <input
                id="staff-otp"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="input-field tracking-[0.3em]"
                placeholder="••••••"
                autoComplete="one-time-code"
              />
            </div>
          )}
          {otpHint && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{otpHint}</p>}
          {error && <ErrorText text={error} />}
          <button type="submit" className="btn-primary w-full">
            {otpSent ? "Verify code" : "Send email code"}
          </button>
          {otpSent && (
            <button type="button" className="w-full text-sm font-semibold text-burgundy" onClick={sendCode}>
              Resend code
            </button>
          )}
        </form>
      )}

      {portal === "admin" && (
        <div className="mt-5 rounded-xl bg-warm-cream p-4 text-xs leading-5 text-text-muted">
          <p className="font-semibold text-text-primary">Demo credentials</p>
          <p>admin@vaidyagogate.org · password admin123</p>
        </div>
      )}

      <Link href="/" className="mt-6 block text-center text-sm font-medium text-text-muted transition hover:text-burgundy">
        ← Back to website
      </Link>
    </Card>
  );
}

function EmailField({
  portal,
  email,
  setEmail,
}: {
  portal: string;
  email: string;
  setEmail: (value: string) => void;
}) {
  return (
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
  );
}

function ErrorText({ text }: { text: string }) {
  return <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{text}</p>;
}

function Card({
  portal,
  children,
}: {
  portal: "admin" | "staff" | "doctor";
  children: React.ReactNode;
}) {
  const { label, hint } = copy[portal];
  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-cream/40 px-5">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
          <div className="flex justify-center">
            <SiteLogo size={56} />
          </div>
          <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-burgundy">
            {label} console
          </p>
          <h1 className="mt-1 text-center text-2xl font-bold text-text-primary">
            {label} sign in
          </h1>
          <p className="mt-2 text-center text-sm text-text-muted">
            {portal === "staff"
              ? "Use your registered staff email and password, or a one-time code emailed to that address."
              : `Use your ${hint} email and password, then the email verification code. Sessions stay signed in until Logout.`}
          </p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </main>
  );
}
