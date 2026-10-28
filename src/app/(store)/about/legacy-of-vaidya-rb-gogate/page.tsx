import type { Metadata } from "next";
import { LegacyLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Legacy of Vaidya R. B. Gogate",
  description:
    "The life, scholarship and enduring legacy of Vaidya R. B. Gogate — physician, teacher and pioneer of classical Ayurveda who inspired the Foundation.",
};

export default function LegacyPage() {
  return <LegacyLive />;
}
