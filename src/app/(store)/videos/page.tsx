import type { Metadata } from "next";
import { VideosIndex } from "@/components/site/PublicRecords";

export const metadata: Metadata = {
  title: "Videos",
};

export default function VideosPage() {
  return <VideosIndex />;
}
