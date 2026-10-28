"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { CourierPerformanceDesk } from "@/components/admin/OperationsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <CourierPerformanceDesk />
    </ClientOnly>
  );
}
