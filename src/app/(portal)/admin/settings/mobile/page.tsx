"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { MobileAppDesk } from "@/components/admin/MobileAppDesk";

export default function Page() {
  return (
    <ClientOnly>
      <MobileAppDesk />
    </ClientOnly>
  );
}
