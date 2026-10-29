"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { AnalyticsDesk } from "@/components/admin/AnalyticsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <AnalyticsDesk />
    </ClientOnly>
  );
}
