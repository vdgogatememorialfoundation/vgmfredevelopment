import type { Metadata } from "next";
import { NoticesIndex } from "@/components/site/PublicRecords";

export const metadata: Metadata = {
  title: "Notice Board",
  description: "Official notices, deadlines, results and updates from the Vaidya Gogate Memorial Foundation.",
};

export default function NoticesPage() {
  return <NoticesIndex />;
}
