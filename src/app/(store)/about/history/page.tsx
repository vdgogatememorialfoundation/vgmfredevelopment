import type { Metadata } from "next";
import { HistoryLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "History",
  description:
    "Renowned vaidyas for many generations: Vd. Mahadev (Bapu) Gogate, rajavaidya to the king of Jawhar; Vd. Vishnu Mahadev Gogate (Dravyaguna); Vd. Trimbak Mahadev Gogate (Panchakarma); and Vd. Ramchandra Ballal Gogate (Shalya tantra).",
};

export default function HistoryPage() {
  return <HistoryLive />;
}
