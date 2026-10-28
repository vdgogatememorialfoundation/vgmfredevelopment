"use client";

import { PaymentSettingsDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <PaymentSettingsDesk />
    </ClientOnly>
  );
}
