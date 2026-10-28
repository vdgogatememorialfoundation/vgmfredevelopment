"use client";

import { ModuleAccessDesk } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <ModuleAccessDesk />
    </ClientOnly>
  );
}
