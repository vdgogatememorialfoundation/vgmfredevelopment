"use client";

import Link from "next/link";
import { useState } from "react";
import ClientOnly from "@/components/common/ClientOnly";
import { getOrders } from "@/lib/store";

function PaymentsSummary() {
  const [orders] = useState(() => getOrders());
  const paid = orders.filter((order) => order.paymentStatus === "Paid").length;
  const refunded = orders.filter((order) => order.paymentStatus === "Refunded").length;
  const pending = orders.filter((order) => order.paymentStatus === "Pending" || order.paymentStatus === "Failed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#4F1414]">Commerce payments</h1>
        <p className="mt-1 text-sm text-gray-600">Order payments from the store, with refunds issued from the refunds desk.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Orders</p>
          <p className="mt-2 text-3xl font-semibold">{orders.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Paid</p>
          <p className="mt-2 text-3xl font-semibold">{paid}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Pending or failed</p>
          <p className="mt-2 text-3xl font-semibold">{pending}</p>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-gray-600">{refunded} refunded.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/admin/commerce/orders" className="rounded-lg bg-[#651C1C] px-4 py-2 text-sm font-semibold text-white">
            Process orders
          </Link>
          <Link href="/admin/payments/refunds" className="rounded-lg border px-4 py-2 text-sm font-semibold">
            Issue refunds
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ClientOnly>
      <PaymentsSummary />
    </ClientOnly>
  );
}
