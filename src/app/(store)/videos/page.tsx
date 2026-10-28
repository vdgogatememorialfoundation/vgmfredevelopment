import type { Metadata } from "next";
import { VideosIndex } from "@/components/site/PublicRecords";

export const metadata: Metadata = {
  title: "Videos",
  description: "Lectures, seminar recordings and documentaries from Vaidya Gogate Memorial Foundation.",
};

export default function VideosPage() {
  return <VideosIndex />;
}
