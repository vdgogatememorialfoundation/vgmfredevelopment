"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { ShippingApisDesk } from "@/components/admin/SettingsDesks";

export default function Page() {
  return (
    <ClientOnly>
      <ShippingApisDesk />
    </ClientOnly>
  );
}
