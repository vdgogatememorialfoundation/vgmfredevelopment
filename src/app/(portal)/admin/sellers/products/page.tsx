"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { ProductsSection } from "@/components/admin/AdminProducts";

export default function Page() {
  return (
    <ClientOnly>
      <ProductsSection />
    </ClientOnly>
  );
}
