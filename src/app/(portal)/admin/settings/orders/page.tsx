"use client";

import { OrderSettingsDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <OrderSettingsDesk />
    </ClientOnly>
  );
}
