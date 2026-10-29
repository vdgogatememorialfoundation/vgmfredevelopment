import { Suspense } from "react";
import SiteLogo from "@/components/common/SiteLogo";
import type { Metadata } from "next";
import Link from "next/link";
import SignupFlow from "@/components/account/SignupFlow";
import SignInFlow from "@/components/account/SignInFlow";

export const metadata: Metadata = {
  title: "Login / Create Account",
  description:
    "Create a Vaidya Gogate Memorial Foundation account or log in to manage shop orders and your profile.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const { mode, next } = await searchParams;
  const signInMode = mode === "signin";
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";

  return (
    <main className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
        {/* Left panel */}
        <section className="hidden flex-col justify-center border-r border-border bg-slate-50 px-10 py-16 text-text-primary lg:flex xl:px-20">
          <div className="max-w-lg">
            <SiteLogo size={64} className="mb-8" />

            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-burgundy">
              Vaidya Gogate Memorial Foundation
            </p>

            <h1 className="font-serif text-4xl font-bold leading-tight xl:text-5xl">
              One account for the whole Foundation.
            </h1>

            <p className="mt-6 text-base leading-7 text-text-muted">
              Register once and use your account for shop purchases and
              other Foundation services.
            </p>

            <div className="mt-10 space-y-5">
              <Step
                number={1}
                title={signInMode ? "Sign in" : "Create your account"}
                text={
                  signInMode
                    ? "Use your email, phone or Account ID."
                    : "Enter your basic details."
                }
              />
              <Step
                number={2}
                title="Verify your contact details"
                text="Verify email and WhatsApp."
              />
              <Step
                number={3}
                title="Access your dashboard"
                text={
                  signInMode
                    ? "Manage everything from one place."
                    : "Receive your unique 12-digit Account ID."
                }
              />
            </div>

            {signInMode && (
              <p className="mt-10 rounded-xl border border-border bg-white p-4 text-sm text-text-muted">
                <strong className="text-text-primary">Demo tip:</strong> sign up
                once using the Create Account tab, then you can sign in
                here with the same email or Account ID.
              </p>
            )}
          </div>
        </section>

        {/* Right form */}
        <section className="flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-xl">
            <Link
              href="/"
              className="mb-8 inline-flex text-sm font-medium text-text-muted transition hover:text-burgundy"
            >
              ← Back to website
            </Link>

            <div className="mb-8 grid grid-cols-2 gap-2 rounded-xl border border-border bg-white p-1.5">
              <Link
                href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                  !signInMode
                    ? "bg-burgundy text-white"
                    : "text-text-muted hover:text-burgundy"
                }`}
              >
                Create Account
              </Link>
              <Link
                href={`/login?mode=signin${nextQuery}`}
                className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                  signInMode
                    ? "bg-burgundy text-white"
                    : "text-text-muted hover:text-burgundy"
                }`}
              >
                Sign In
              </Link>
            </div>

            {signInMode ? <SignInFlow /> : (
              <Suspense fallback={<p className="text-sm text-text-muted">Loading…</p>}>
                <SignupFlow />
              </Suspense>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: number;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-burgundy/30 bg-white text-burgundy">
        {number}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-text-muted">{text}</p>
      </div>
    </div>
  );
}