"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import OtpForm from "@/components/account/OtpForm";
import { ForgotPasswordForm } from "@/components/account/PasswordResetForm";
import { useAuth } from "@/components/auth/AuthContext";
import { findAccountByIdentifier, loginBlockReason, saveAccount } from "@/lib/auth";
import { sendOtpCode } from "@/lib/admin-store";
import { getAuthAccess } from "@/lib/auth-access";
import { subscribeCms } from "@/lib/cms";
import { issueEmailOtp, verifyEmailOtp } from "@/lib/otp";
import { lookupPartnerAccount } from "@/lib/partner-hydrate";
import type { User } from "@/types";

type Step = "identifier" | "otp" | "forgot" | "complete";
type Method = "password" | "otp" | "sms";

export default function SignInFlow() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [access, setAccess] = useState(getAuthAccess);
  useEffect(() => subscribeCms(() => setAccess(getAuthAccess())), []);
  const [step, setStep] = useState<Step>("identifier");
  const [method, setMethod] = useState<Method>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [otpHint, setOtpHint] = useState("");
  const [pending, setPending] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const enterAccount = (account: User) => {
    signIn(account);
    const next = new URLSearchParams(window.location.search).get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      router.push(next);
      return;
    }
    setStep("complete");
  };

  const sendEmailMfa = (account: User) => {
    const code = issueEmailOtp(account.email, "customer");
    sendOtpCode({
      email: account.email,
      phone: account.phone,
      name: account.firstName,
      code,
      purpose: "sign-in",
    });
    setPending(account);
    setOtpHint(`A code was sent to ${account.email}.`);
    setStep("otp");
  };

  const sendSmsOtp = (account: User) => {
    const code = issueEmailOtp(account.phone, "customer-sms");
    sendOtpCode({
      phone: account.phone,
      name: account.firstName,
      code,
      purpose: "SMS sign-in",
    });
    setPending(account);
    setOtpHint(`A code was sent by SMS to ${account.phone}.`);
    setStep("otp");
  };

  const sendLoginOtp = (account: User) => {
    const code = issueEmailOtp(account.email, "customer-otp");
    sendOtpCode({
      email: account.email,
      phone: account.phone,
      name: account.firstName,
      code,
      purpose: "email OTP sign-in",
    });
    setPending(account);
    setOtpHint(`A code was sent to ${account.email}.`);
    setStep("otp");
  };

  const resolveAccount = async () => {
    const local = findAccountByIdentifier(identifier);
    const remote = await lookupPartnerAccount({
      identifier,
      password: method === "password" ? password : undefined,
    });
    const account = findAccountByIdentifier(identifier) || remote.account || local;
    if (account && remote.passwordOk && password) {
      const next = { ...account, password, partnerPasswordSet: true, role: account.role === "admin" || account.role === "coadmin" || account.role === "staff" ? account.role : "customer" as const };
      saveAccount(next);
      return { account: next, passwordOk: true, passwordSet: true };
    }
    return {
      account,
      passwordOk: remote.passwordOk || Boolean(local?.password && password && local.password === password),
      passwordSet: remote.passwordSet || Boolean(account?.password || account?.partnerPasswordSet),
    };
  };

  const handleIdentifier = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const resolved = await resolveAccount();
      const account = resolved.account;
      if (!account) {
        setError("No account found with these details. Please create an account first.");
        return;
      }
      const blocked = loginBlockReason(account);
      if (blocked) {
        setError(blocked);
        return;
      }
      if (method === "sms") {
        if (!access.smsLogin) {
          setError("SMS login is turned off.");
          return;
        }
        sendSmsOtp(account);
        return;
      }
      if (method === "otp") {
        if (!access.emailOtp) {
          setError("Email OTP login is available once ZeptoMail is connected.");
          return;
        }
        sendLoginOtp(account);
        return;
      }
      if (!password) {
        setError("Enter your password, then we will send a one-time code to your email.");
        return;
      }
      if (!resolved.passwordOk) {
        if (!account.password && resolved.passwordSet) {
          setError(
            access.emailOtp
              ? "This account is linked from a sister portal. Use Email OTP, forgot password, or the original Seminar / Autism / Fellowship password."
              : "This account is linked from a sister portal. Use forgot password to set a Foundation password, or sign in with the original Seminar / Autism / Fellowship password."
          );
          return;
        }
        setError("Incorrect password. Use forgot password if you need a reset.");
        return;
      }
      if (!access.emailOtp) {
        enterAccount(account);
        return;
      }
      sendEmailMfa(account);
    } finally {
      setBusy(false);
    }
  };

  const handleOtp = (code: string) => {
    const account = pending ?? findAccountByIdentifier(identifier);
    if (!account) {
      setError("Sign in again so we can send a new code.");
      setStep("identifier");
      return;
    }
    const role = method === "sms" ? "customer-sms" : method === "otp" ? "customer-otp" : "customer";
    const target = method === "sms" ? account.phone : account.email;
    const invalid = verifyEmailOtp(target, role, code);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    enterAccount(account);
  };

  if (!access.loginEnabled) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Sign-in is turned off. {access.signupEnabled ? "You can still create an account." : "Please contact the Foundation office."}
      </p>
    );
  }

  if (step === "forgot") {
    return (
      <ForgotPasswordForm
        role="customer"
        onBack={() => setStep("identifier")}
        onComplete={(account) => {
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
      <div>
        {otpHint && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{otpHint}</p>}
        {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        <OtpForm
          title={method === "sms" ? "SMS verification" : "Email verification"}
          description={
            method === "sms"
              ? "Enter the 6-digit code sent to your registered mobile. You can resend after 1 minute."
              : method === "otp"
                ? "Enter the 6-digit code emailed to your registered address. You can resend after 1 minute."
                : "Password accepted. Enter the 6-digit code emailed to your registered address. You can resend after 1 minute."
          }
          onSubmit={handleOtp}
          onBack={() => setStep("identifier")}
          onResend={() => {
            const account = pending ?? findAccountByIdentifier(identifier);
            if (!account) return;
            if (method === "sms") sendSmsOtp(account);
            else if (method === "otp") sendLoginOtp(account);
            else sendEmailMfa(account);
          }}
        />
      </div>
    );
  }

  const methods: { id: Method; label: string; show: boolean }[] = [
    { id: "password", label: "Email / password", show: true },
    { id: "otp", label: "Email OTP", show: access.emailOtp },
    { id: "sms", label: "SMS OTP", show: access.smsLogin },
  ];
  const visibleMethods = methods.filter((item) => item.show);

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
          {method === "sms"
            ? "Sign in with the mobile number on your account. We send a one-time SMS code."
            : method === "otp"
              ? "Sign in with a one-time code emailed to your registered address."
              : access.emailOtp
                ? "Sign in with your password. We then email a one-time code — both are required."
                : "Sign in with your registered email, phone or account ID and password."}
        </p>
      </div>

      {visibleMethods.length > 1 && (
        <div className={`mb-5 grid gap-2 rounded-xl border border-border bg-white p-1.5 ${visibleMethods.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {visibleMethods.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${method === item.id ? "bg-burgundy text-white" : "text-text-muted"}`}
              onClick={() => setMethod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(event) => void handleIdentifier(event)} className="space-y-5">
        <div>
          <label
            className="mb-2 block text-sm font-semibold text-text-primary"
            htmlFor="signin-identifier"
          >
            {method === "sms" ? "Registered mobile number" : "Email, Phone or Account ID"}
          </label>
          <input
            id="signin-identifier"
            type="text"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="input-field"
            placeholder={method === "sms" ? "+91 98765 43210" : "name@example.com / +91 98765 43210 / 12-digit Account ID"}
            autoComplete="username"
          />
        </div>
        {method === "password" && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="signin-password">
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy
            ? "Checking…"
            : method === "sms"
              ? "Send SMS code"
              : method === "otp"
                ? "Send email code"
                : access.emailOtp
                  ? "Continue to verification"
                  : "Sign in"}
        </button>
        {method === "password" && (
          <button type="button" className="w-full text-sm font-semibold text-burgundy" onClick={() => setStep("forgot")}>
            Forgot password?
          </button>
        )}
      </form>
    </div>
  );
}
