"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { SiteExtrasDesk } from "@/components/admin/SiteExtrasDesk";

export default function Page() {
  return (
    <ClientOnly>
      <SiteExtrasDesk />
    </ClientOnly>
  );
}
