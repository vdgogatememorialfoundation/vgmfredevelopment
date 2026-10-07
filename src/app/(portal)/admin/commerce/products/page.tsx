"use client";

import { ProductsSection } from "@/components/admin/AdminProducts";
import { ProductServiceabilityDesk } from "@/components/admin/FulfillmentDesk";

export default function Page() {
  return (
    <div className="space-y-10">
      <ProductsSection />
      <ProductServiceabilityDesk />
    </div>
  );
}
