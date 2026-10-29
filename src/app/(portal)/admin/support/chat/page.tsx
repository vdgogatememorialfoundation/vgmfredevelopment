"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { LiveChatDesk } from "@/components/admin/AdminSupport";

export default function Page() {
  return (
    <ClientOnly>
      <LiveChatDesk />
    </ClientOnly>
  );
}
