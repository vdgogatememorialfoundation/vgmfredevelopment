"use client";

import { ReviewsDesk } from "@/components/admin/ReviewsDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <ReviewsDesk />
    </ClientOnly>
  );
}
