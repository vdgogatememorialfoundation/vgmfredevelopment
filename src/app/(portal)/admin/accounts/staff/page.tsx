"use client";

import { StaffDesk } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <StaffDesk />
    </ClientOnly>
  );
}
