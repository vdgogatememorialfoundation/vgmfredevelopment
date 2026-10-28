"use client";

import { ShippingApisDesk } from "@/components/admin/SettingsDesks";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <ShippingApisDesk />
    </ClientOnly>
  );
}
