"use client";

import { NotificationsDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";
import { EmailLogDesk } from "@/components/admin/EmailLogDesk";

export default function Page() {
  return (
    <ClientOnly>
      <div className="space-y-5">
        <EmailLogDesk />
        <NotificationsDesk compose />
      </div>
    </ClientOnly>
  );
}
