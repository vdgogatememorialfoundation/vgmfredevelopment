import type { Metadata } from "next";
import { ScholarshipLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Books & Research",
  description:
    "Books and research of Vd. R. B. Gogate — AIDS, Viddha and Agnikarma, Bhagna and Asthi roga, Shalya tantra, Hasti ayurved, cancer, raktamokshan and dhoopan chikitsa. The Foundation publishes articles, not journals.",
};

export default function BooksAndResearchPage() {
  return <ScholarshipLive />;
}
