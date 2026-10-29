import type { Metadata } from "next";
import PolicyView from "@/components/site/PolicyView";

export const metadata: Metadata = {
  title: "Return Policy",
  description: "Return policy for books and publications from the Vaidya Gogate Memorial Foundation.",
};

export default function ReturnPolicyPage() {
  return <PolicyView id="returns" />;
}
