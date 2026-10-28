"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { ShipmentsSection } from "@/components/admin/AdminShipments";

export default function Page() {
  return (
    <ClientOnly>
      <ShipmentsSection />
    </ClientOnly>
  );
}
