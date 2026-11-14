"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SectionHeader from "@/components/account/SectionHeader";
import EmptyState from "@/components/account/EmptyState";
import { useAuth } from "@/components/auth/AuthContext";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { getStoreCredit, getStoreCreditExpiry, getStoreCreditId, getStoreCreditLedger } from "@/lib/admin-store";
import { formatPrice, getOrdersForAccount } from "@/lib/store";
import { formatDate } from "@/lib/utils";

const REFUND_STATE: Record<string, string> = {
  pending: "Processing with the bank",
  processed: "Credited",
  failed: "Failed — the desk will retry",
};

export default function WalletPage() {
  const { user } = useAuth();
  const { ready, version } = useCommerceMirror();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  void version;
  const live = mounted && ready && Boolean(user?.email);
  const balance = live ? getStoreCredit(user?.email) : 0;
  const ledger = live ? getStoreCreditLedger(user?.email) : [];
  const expiring = live && balance > 0 ? getStoreCreditExpiry(user?.email) : null;
  const walletId = live ? getStoreCreditId(user?.email) : "";
  const refunds = live
    ? getOrdersForAccount(user).flatMap((order) =>
        (order.refunds ?? []).filter((refund) => refund.destination === "original").map((refund) => ({ order, refund }))
      )
    : [];

  return (
    <div className="min-w-0">
      <SectionHeader
        title="Store Wallet"
        description="Store credit from refunds and goodwill credits. It is applied automatically at checkout when you tick “Use store credit”."
      />

      <div className="rounded-2xl border border-burgundy/15 bg-burgundy/5 p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Available balance</p>
        <p className="mt-2 text-4xl font-bold text-burgundy sm:text-5xl">{live ? formatPrice(balance) : "…"}</p>
        {expiring && (
          <p className="mt-2 text-sm font-medium text-amber-700">
            {formatPrice(expiring.amount)} expires on {formatDate(expiring.at)}
          </p>
        )}
        {walletId && (
          <p className="mt-3 text-sm text-text-primary">
            Store Credit ID <span className="ml-1 rounded-md bg-white px-2 py-0.5 font-mono text-base font-bold tracking-[0.2em] text-burgundy">{walletId}</span>
            <span className="mt-1 block text-xs text-text-muted">Give this ID at the Foundation counter to pay with store credit. Keep it to yourself.</span>
          </p>
        )}
        <p className="mt-2 text-sm text-text-muted">Use it on any shop order. Store credit cannot be withdrawn to a bank account.</p>
        <Link href="/shop" className="mt-4 inline-block rounded-full bg-burgundy px-5 py-2 text-sm font-semibold text-white">
          Shop now
        </Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-text-primary">Wallet history</h2>
      {ledger.length ? (
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-white">
          {ledger.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="min-w-0 break-words">
                <span className="block font-medium text-text-primary">{entry.note || (entry.amount > 0 ? "Credit added" : "Used on an order")}</span>
                <span className="text-xs text-text-muted">
                  {formatDate(entry.at)}
                  {entry.amount > 0 && entry.expiresAt ? ` · valid till ${formatDate(entry.expiresAt)}` : ""}
                  {entry.orderId ? (
                    <>
                      {" · "}
                      <Link href={`/account/orders/${encodeURIComponent(entry.orderId)}`} className="text-burgundy underline">
                        Order {entry.orderId}
                      </Link>
                    </>
                  ) : null}
                </span>
              </span>
              <span className={`font-semibold ${entry.amount > 0 ? "text-emerald-700" : "text-text-primary"}`}>
                {entry.amount > 0 ? "+" : "−"}
                {formatPrice(Math.abs(entry.amount))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <EmptyState title="No wallet activity yet" description="Refunds sent to store credit and credits from the Foundation desk will appear here." />
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold text-text-primary">Refunds to your payment method</h2>
      {refunds.length ? (
        <ul className="mt-3 space-y-3">
          {refunds.map(({ order, refund }) => (
            <li key={`${order.id}:${refund.id}`} className="rounded-2xl border border-border bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/account/orders/${encodeURIComponent(order.id)}`} className="font-semibold text-burgundy underline">
                  Order {order.id}
                </Link>
                <span className="font-semibold text-text-primary">{formatPrice(refund.amount)}</span>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-text-muted sm:grid-cols-2">
                <div>Status: <span className="text-text-primary">{REFUND_STATE[refund.status ?? ""] ?? "Recorded by the desk"}</span></div>
                <div>Initiated: <span className="text-text-primary">{formatDate(refund.at)}</span></div>
                {refund.processedAt ? <div>Credited: <span className="text-text-primary">{formatDate(refund.processedAt)}</span></div> : null}
                {refund.gatewayRefundId ? <div className="break-all">Refund ID: <span className="text-text-primary">{refund.gatewayRefundId}</span></div> : null}
                {refund.rrn ? <div className="break-all">Bank RRN: <span className="text-text-primary">{refund.rrn}</span></div> : null}
                {refund.arn ? <div className="break-all">ARN: <span className="text-text-primary">{refund.arn}</span></div> : null}
                {refund.utr ? <div className="break-all">UTR: <span className="text-text-primary">{refund.utr}</span></div> : null}
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-text-muted">No refunds to your card, UPI or bank yet.</p>
      )}
    </div>
  );
}
