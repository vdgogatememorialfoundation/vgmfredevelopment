import type { Metadata } from "next";
import PolicyView from "@/components/site/PolicyView";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for the Vaidya Gogate Memorial Foundation website and services.",
};

export default function PrivacyPolicyPage() {
  return <PolicyView id="privacy" />;
}
