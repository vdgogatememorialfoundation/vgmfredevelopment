"use client";

import { FirebaseSettingsDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <FirebaseSettingsDesk />
    </ClientOnly>
  );
}
