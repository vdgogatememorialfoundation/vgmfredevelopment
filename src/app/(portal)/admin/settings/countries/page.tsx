"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { CountriesDesk } from "@/components/admin/CountriesDesk";

export default function Page() {
  return (
    <ClientOnly>
      <CountriesDesk />
    </ClientOnly>
  );
}
