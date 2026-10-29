import type { Metadata } from "next";
import { TrusteesLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Trustees & Team",
  description:
    "Meet the trustees, scholars and staff of the Vaidya Gogate Memorial Foundation.",
};

export default function TrusteesPage() {
  return <TrusteesLive />;
}
