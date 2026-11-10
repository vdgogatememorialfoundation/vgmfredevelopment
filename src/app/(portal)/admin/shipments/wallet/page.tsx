"use client";

import ClientOnly from "@/components/common/ClientOnly";
import CourierWallets from "@/components/admin/CourierWallets";

export default function Page() {
  return (
    <ClientOnly>
      <CourierWallets />
    </ClientOnly>
  );
}
