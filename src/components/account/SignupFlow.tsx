"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import DetailsForm from "@/components/account/DetailsForm";
import OtpForm from "@/components/account/OtpForm";
import AccountCreated from "@/components/account/AccountCreated";
import { useAuth } from "@/components/auth/AuthContext";
import { demoAccountId, findAccountByIdentifier, saveAccount, setSession } from "@/lib/auth";
import { displayName, sendAccountDetails } from "@/lib/admin-store";
import type { User } from "@/types";

type Step = "details" | "email" | "whatsapp" | "success";

function newUserId() {
  return `usr-${Date.now()}`;
}

export default function SignupFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("details");

  const [form, setForm] = useState({
    salutation: "Dr.",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    whatsapp: "",
  });

  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");

  const submitDetails = () => {
    if (findAccountByIdentifier(form.email) || findAccountByIdentifier(form.phone)) {
      setError("An account already exists with this email or phone. Please sign in instead.");
      return;
    }
    setError("");
    setStep("email");
  };

  const updateField = (field: string, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const completeSignup = () => {
    const accountIdValue = demoAccountId();
    setAccountId(accountIdValue);

    const user: User = {
      id: newUserId(),
      salutation: form.salutation,
      firstName: form.firstName,
      middleName: form.middleName || undefined,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      whatsapp: form.whatsapp,
      accountId: accountIdValue,
      role: "customer",
      status: "active",
      storeCredit: 0,
      createdAt: new Date().toISOString(),
    };

    saveAccount(user);
    sendAccountDetails(user.email, true);
    setSession(user);
    signIn(user);

    if (nextPath?.startsWith("/") && !nextPath.startsWith("//")) {
      router.push(nextPath);
      return;
    }
    setStep("success");
  };

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">
          Create Account
        </p>

        <h2 className="text-xl font-semibold text-text-primary">
          Welcome to VGMF
        </h2>

        <p className="mt-3 text-sm leading-6 text-text-muted">
          Create your account to register for events, manage tickets,
          certificates and orders.
        </p>
      </div>

      {step === "details" && (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <DetailsForm
            form={form}
            onChange={updateField}
            onSubmit={submitDetails}
          />
          {error && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <p className="mt-5 text-center text-sm text-text-muted">
            Already have an account?{" "}
            <Link href={nextPath?.startsWith("/") && !nextPath.startsWith("//") ? `/login?mode=signin&next=${encodeURIComponent(nextPath)}` : "/login?mode=signin"} className="font-semibold text-burgundy">
              Login
            </Link>
          </p>
        </div>
      )}

      {step === "email" && (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <OtpForm
            title="Verify your email"
            description={`We sent a verification code to ${form.email}.`}
            onSubmit={() => setStep("whatsapp")}
            onBack={() => setStep("details")}
            onResend={() => undefined}
          />
        </div>
      )}

      {step === "whatsapp" && (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <OtpForm
            title="Verify WhatsApp"
            description={`We sent a verification code to ${form.whatsapp}.`}
            onSubmit={completeSignup}
            onBack={() => setStep("email")}
            onResend={() => undefined}
          />
        </div>
      )}

      {step === "success" && (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <AccountCreated
            accountId={accountId}
            name={displayName(form, true)}
          />
        </div>
      )}
    </>
  );
}