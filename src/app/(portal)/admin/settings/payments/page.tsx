"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { SectionSettingsDesk } from "@/components/admin/OperationsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <SectionSettingsDesk section="payments" />
    </ClientOnly>
  );
}
