import type { Metadata } from "next";
import { AnnouncementsIndex } from "@/components/site/PublicRecords";

export const metadata: Metadata = {
  title: "Announcements",
  description: "All announcements from the Vaidya Gogate Memorial Foundation.",
};

export default function AnnouncementsPage() {
  return <AnnouncementsIndex />;
}
