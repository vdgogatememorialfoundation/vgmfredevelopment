import type { Metadata } from "next";
import { Suspense } from "react";
import PayClient from "./PayClient";

export const metadata: Metadata = { title: "Complete your payment", robots: { index: false } };

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <Suspense fallback={<main className="container py-20 text-center text-text-muted">Loading payment…</main>}>
      <PayClient orderId={orderId} />
    </Suspense>
  );
}
