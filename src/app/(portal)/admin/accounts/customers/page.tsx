"use client";

import { CustomerDesk } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <CustomerDesk />
    </ClientOnly>
  );
}
