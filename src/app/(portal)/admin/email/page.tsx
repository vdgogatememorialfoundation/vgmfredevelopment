"use client";

import { NotificationsDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <NotificationsDesk compose />
    </ClientOnly>
  );
}
