"use client";

import { MessageTemplatesDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <MessageTemplatesDesk />
    </ClientOnly>
  );
}
