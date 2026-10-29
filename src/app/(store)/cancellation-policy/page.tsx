import type { Metadata } from "next";
import PolicyView from "@/components/site/PolicyView";

export const metadata: Metadata = {
  title: "Cancellation Policy",
  description: "Cancellation policy for orders placed through the Vaidya Gogate Memorial Foundation website.",
};

export default function CancellationPolicyPage() {
  return <PolicyView id="cancellation" />;
}
