import type { Metadata } from "next";
import PolicyView from "@/components/site/PolicyView";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund policy for book orders from the Vaidya Gogate Memorial Foundation.",
};

export default function RefundPolicyPage() {
  return <PolicyView id="refund" />;
}
