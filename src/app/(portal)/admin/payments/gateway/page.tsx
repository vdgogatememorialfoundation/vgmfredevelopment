"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { GatewayDesk } from "@/components/admin/OperationsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <GatewayDesk />
    </ClientOnly>
  );
}
