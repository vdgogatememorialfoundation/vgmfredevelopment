"use client";

import { Suspense } from "react";
import { AnnouncementAdmin } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientOnly>
        <AnnouncementAdmin />
      </ClientOnly>
    </Suspense>
  );
}
