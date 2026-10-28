"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { CarrierDesk } from "@/components/admin/FulfillmentDesk";

export default function Page() {
  return (
    <ClientOnly>
      <CarrierDesk />
    </ClientOnly>
  );
}
