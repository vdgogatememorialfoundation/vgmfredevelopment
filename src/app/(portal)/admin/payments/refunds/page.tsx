"use client";

import { RefundsDesk } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <RefundsDesk />
    </ClientOnly>
  );
}
