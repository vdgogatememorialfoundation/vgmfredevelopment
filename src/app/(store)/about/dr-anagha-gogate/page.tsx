import type { Metadata } from "next";
import { AnaghaLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Dr. Anagha Gogate",
  description:
    "Dr. Anagha Ramchandra Gogate (1936–2019) gave unwavering support and strength to Vd. Ramchandra B. Gogate as physician, teacher and the strongest pillar of the family.",
};

export default function AnaghaPage() {
  return <AnaghaLive />;
}
