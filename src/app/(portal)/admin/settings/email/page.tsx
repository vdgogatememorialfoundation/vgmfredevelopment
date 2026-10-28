"use client";

import { ZeptoDesk } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <ZeptoDesk />
    </ClientOnly>
  );
}
