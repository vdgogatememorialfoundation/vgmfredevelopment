"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { SiteTextDesk } from "@/components/admin/SiteTextDesk";

export default function Page() {
  return (
    <ClientOnly>
      <SiteTextDesk />
    </ClientOnly>
  );
}
