"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { NoticeDesk } from "@/components/admin/NoticeDesk";

export default function Page() {
  return (
    <ClientOnly>
      <NoticeDesk />
    </ClientOnly>
  );
}
