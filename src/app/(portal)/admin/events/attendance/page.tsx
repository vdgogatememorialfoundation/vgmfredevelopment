"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { EventRecordsDesk } from "@/components/admin/OperationsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <EventRecordsDesk kind="attendance" />
    </ClientOnly>
  );
}
