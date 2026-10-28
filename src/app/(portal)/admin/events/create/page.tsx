"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EventEditor } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

function Editor() {
  const id = useSearchParams().get("id");
  return <EventEditor key={id ?? "new"} eventId={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientOnly>
        <Editor />
      </ClientOnly>
    </Suspense>
  );
}
