"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { PartnerSyncDesk } from "@/components/admin/PartnerSyncDesk";

export default function Page() {
  return (
    <ClientOnly>
      <PartnerSyncDesk />
    </ClientOnly>
  );
}
