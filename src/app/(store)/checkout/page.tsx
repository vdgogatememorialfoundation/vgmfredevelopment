import { Suspense } from "react";
import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import RequireAuth from "@/components/auth/RequireAuth";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Complete your purchase from the Vaidya Gogate Memorial Foundation online store.",
};

export default function CheckoutPage() {
  return (
    <RequireAuth message="Sign in to complete your purchase from the Foundation store.">
      <main>
        <PageHeader
          eyebrow="Store"
          title="Checkout"
          description="Provide your delivery details and complete your payment securely."
        />
        <Suspense
          fallback={
            <section className="section bg-background">
              <div className="container mx-auto max-w-6xl space-y-6">
                <div className="h-10 w-72 animate-pulse rounded-lg bg-warm-cream" />
                <div className="h-96 animate-pulse rounded-3xl bg-warm-cream" />
              </div>
            </section>
          }
        >
          <CheckoutClient />
        </Suspense>
      </main>
    </RequireAuth>
  );
}