"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { SiteVisibilityDesk } from "@/components/admin/SiteVisibilityDesk";

export default function Page() {
  return (
    <ClientOnly>
      <SiteVisibilityDesk />
    </ClientOnly>
  );
}
