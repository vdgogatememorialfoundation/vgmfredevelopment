"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { FestivalThemesDesk } from "@/components/admin/FestivalThemesDesk";

export default function Page() {
  return (
    <ClientOnly>
      <FestivalThemesDesk />
    </ClientOnly>
  );
}
