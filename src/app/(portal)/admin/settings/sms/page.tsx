"use client";

import { SmsSettingsDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <SmsSettingsDesk />
    </ClientOnly>
  );
}
