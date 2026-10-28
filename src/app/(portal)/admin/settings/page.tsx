"use client";

import { GeneralSettingsDesk } from "@/components/admin/SettingsDesks";
import { SettingsSection } from "@/components/admin/AdminSettings";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <div className="space-y-10">
        <GeneralSettingsDesk />
        <SettingsSection />
      </div>
    </ClientOnly>
  );
}
