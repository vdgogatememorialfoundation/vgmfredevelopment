"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { CmsPagesDesk } from "@/components/admin/CmsPagesDesk";

export default function Page() {
  return (
    <ClientOnly>
      <CmsPagesDesk />
    </ClientOnly>
  );
}
