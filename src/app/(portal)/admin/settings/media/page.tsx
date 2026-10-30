"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { MediaStorageDesk } from "@/components/admin/MediaStorageDesk";

export default function Page() {
  return (
    <ClientOnly>
      <MediaStorageDesk />
    </ClientOnly>
  );
}
