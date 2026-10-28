"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { ShippingDesk } from "@/components/admin/FulfillmentDesk";

export default function Page() {
  return (
    <ClientOnly>
      <ShippingDesk />
    </ClientOnly>
  );
}
