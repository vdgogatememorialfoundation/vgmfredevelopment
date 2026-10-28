"use client";

import { WhatsAppSettingsDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <WhatsAppSettingsDesk />
    </ClientOnly>
  );
}
