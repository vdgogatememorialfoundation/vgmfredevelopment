import type { Metadata } from "next";
import { AnnouncementsIndex } from "@/components/site/PublicRecords";

export const metadata: Metadata = {
  title: "Announcement archive",
  description: "Archive of ticker announcements from the Vaidya Gogate Memorial Foundation.",
};

export default function AnnouncementsPage() {
  return <AnnouncementsIndex />;
}
