"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { ReconciliationDesk } from "@/components/admin/OperationsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <ReconciliationDesk />
    </ClientOnly>
  );
}
