import type { Metadata } from "next";
import PolicyView from "@/components/site/PolicyView";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms and conditions for the Vaidya Gogate Memorial Foundation website.",
};

export default function TermsPage() {
  return <PolicyView id="terms" />;
}
