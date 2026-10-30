"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { DomainSettingsDesk } from "@/components/admin/DomainSettingsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <DomainSettingsDesk />
    </ClientOnly>
  );
}
