"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";

export default function RequireAuth({
  children,
  message = "This content is available only to registered site users.",
}: {
  children: React.ReactNode;
  message?: string;
}) {
  const { isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-text-muted">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main>
        <section className="section bg-background">
          <div className="container flex max-w-2xl flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-warm-cream text-burgundy">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h1 className="heading-2 mt-6">Member Content</h1>

            <p className="mt-4 text-body">{message}</p>

            <p className="mt-4 text-sm text-text-muted">
              Create a free account with your email and WhatsApp to unlock
              the full Foundation experience — events, shop, articles,
              clinics and more.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/login" className="btn-primary">
                Create Account / Sign In
              </Link>
              <Link href="/" className="btn-outline">
                Back to Home
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return children;
}