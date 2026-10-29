import type { Metadata } from "next";
import PolicyView from "@/components/site/PolicyView";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "Shipping policy for book orders from the Vaidya Gogate Memorial Foundation.",
};

export default function ShippingPolicyPage() {
  return <PolicyView id="shipping" />;
}
