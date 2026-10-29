"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

export default function SupportPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace("/account/tickets");
    }
  }, [isAuthenticated, user, router]);

  return (
    <main className="section bg-background">
      <div className="container max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Support</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Raise a ticket from your dashboard</h1>
        <p className="mt-4 text-sm leading-6 text-text-muted">
          Support tickets are opened from the customer dashboard so your requests stay with your account.
          Sign in, then use Support Tickets to send a message to the Foundation team.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login?next=/account/tickets" className="btn-primary">
            Sign in to raise a ticket
          </Link>
          <Link href="/account/tickets" className="btn-outline">
            Go to my tickets
          </Link>
        </div>
      </div>
    </main>
  );
}
