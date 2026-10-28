"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { PaymentsDesk } from "@/components/admin/OperationsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <PaymentsDesk filter="Paid" />
    </ClientOnly>
  );
}
