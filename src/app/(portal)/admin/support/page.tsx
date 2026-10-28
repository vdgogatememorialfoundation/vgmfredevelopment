"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { SupportSection } from "@/components/admin/AdminSupport";

export default function Page() {
  return (
    <ClientOnly>
      <SupportSection />
    </ClientOnly>
  );
}
