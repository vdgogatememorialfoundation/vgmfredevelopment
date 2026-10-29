"use client";

import { PeopleDesk } from "@/components/admin/PeopleDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <PeopleDesk role="staff" />
    </ClientOnly>
  );
}
