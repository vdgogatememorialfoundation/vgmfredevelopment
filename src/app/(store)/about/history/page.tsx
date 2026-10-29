import type { Metadata } from "next";
import { HistoryLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "History",
  description:
    "The history of the Vaidya Gogate Memorial Foundation — from its founding to the programmes it runs today.",
};

export default function HistoryPage() {
  return <HistoryLive />;
}
