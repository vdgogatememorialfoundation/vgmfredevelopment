"use client";

import { NoticeDesk } from "@/components/admin/NoticeDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <NoticeDesk />
    </ClientOnly>
  );
}
