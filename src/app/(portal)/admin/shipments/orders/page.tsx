"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { OrdersDashboard } from "@/components/admin/AdminOrders";

export default function Page() {
  return (
    <ClientOnly>
      <OrdersDashboard />
    </ClientOnly>
  );
}
