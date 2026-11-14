"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { FormsDesk } from "@/components/admin/FormsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <FormsDesk />
    </ClientOnly>
  );
}
