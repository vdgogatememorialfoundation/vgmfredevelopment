"use client";

import { ReportsDesk } from "@/components/admin/ReportsDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <ReportsDesk />
    </ClientOnly>
  );
}
