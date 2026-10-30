import type { Metadata } from "next";
import { LegacyLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Legacy of Vaidya R. B. Gogate",
  description:
    "Vd. R. B. Gogate (Shalya tantra) will always inspire us, not only as a grandfather but also through his lifetime of study, work and research. His vision is ‘knowledge for all’.",
};

export default function LegacyPage() {
  return <LegacyLive />;
}
