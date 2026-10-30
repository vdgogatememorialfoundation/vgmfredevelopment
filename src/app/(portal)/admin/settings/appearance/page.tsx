"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { AppAppearanceDesk } from "@/components/admin/AppAppearanceDesk";

export default function Page() {
  return (
    <ClientOnly>
      <AppAppearanceDesk />
    </ClientOnly>
  );
}
