"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { SellersSection } from "@/components/admin/AdminSellers";

export default function Page() {
  return (
    <ClientOnly>
      <SellersSection />
    </ClientOnly>
  );
}
