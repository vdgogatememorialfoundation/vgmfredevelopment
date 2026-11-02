"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { WhatsAppInboxDesk } from "@/components/admin/WhatsAppInbox";

export default function Page() {
  return (
    <ClientOnly>
      <WhatsAppInboxDesk />
    </ClientOnly>
  );
}
