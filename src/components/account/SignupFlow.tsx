"use client";

import Link from "next/link";
import { useState } from "react";
import DetailsForm from "@/components/account/DetailsForm";
import OtpForm from "@/components/account/OtpForm";
import AccountCreated from "@/components/account/AccountCreated";
import { useAuth } from "@/components/auth/AuthContext";
import { demoAccountId, saveAccount, setSession } from "@/lib/auth";
import type { User } from "@/types";

type Step = "details" | "email" | "whatsapp" | "success";

export default function SignupFlow() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("details");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    whatsapp: "",
  });

  const [accountId, setAccountId] = useState("");

  const updateField = (field: string, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const completeSignup = () => {
    const accountIdValue = demoAccountId();
    setAccountId(accountIdValue);

    const user: User = {
      id: `usr-${Date.now()}`,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      whatsapp: form.whatsapp,
      accountId: accountIdValue,
    };

    saveAccount(user);
    setSession(user);
    signIn(user);

    setStep("success");
  };

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">
          Create Account
        </p>

        <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
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
            onSubmit={() => setStep("email")}
          />

          <p className="mt-5 text-center text-sm text-text-muted">
            Already have an account?{" "}
            <Link href="/login?mode=signin" className="font-semibold text-burgundy">
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
            name={`${form.firstName} ${form.lastName}`}
          />
        </div>
      )}
    </>
  );
}