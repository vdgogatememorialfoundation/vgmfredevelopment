"use client";

import { PolicyDesk } from "@/components/admin/PolicyDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <PolicyDesk />
    </ClientOnly>
  );
}
