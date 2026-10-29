import type { Metadata } from "next";
import { FoundationLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Foundation",
  description:
    "The mission, vision and objectives of the Vaidya Gogate Memorial Foundation.",
};

export default function FoundationPage() {
  return <FoundationLive />;
}
