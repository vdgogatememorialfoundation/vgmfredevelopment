import type { Metadata } from "next";
import LegalIndex from "@/components/site/LegalIndex";

export const metadata: Metadata = {
  title: "Legal",
  description: "All policies of the Vaidya Gogate Memorial Foundation: privacy, terms, shipping, returns, refunds and cancellations.",
};

export default function LegalIndexPage() {
  return <LegalIndex />;
}
