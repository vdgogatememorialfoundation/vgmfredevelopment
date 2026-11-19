"use client";

import { CustomerPurchasesDesk } from "@/components/admin/CustomerPurchasesDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <CustomerPurchasesDesk />
    </ClientOnly>
  );
}
