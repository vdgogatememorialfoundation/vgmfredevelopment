"use client";

import ClientOnly from "@/components/common/ClientOnly";
import RiderOpsDesk from "@/components/admin/RiderOpsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <RiderOpsDesk />
    </ClientOnly>
  );
}
