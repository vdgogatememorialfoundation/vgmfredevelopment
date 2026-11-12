"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { InvoicesDesk } from "@/components/admin/InvoicesDesk";

export default function Page() {
  return (
    <ClientOnly>
      <InvoicesDesk />
    </ClientOnly>
  );
}
