import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import AwardsSection from "@/components/home/AwardsSection";

export const metadata: Metadata = {
  title: "Awards",
  description: "Awards presented at Foundation seminars and programmes.",
};

export default function AwardsPage() {
  return (
    <main>
      <PageHeader eyebrow="Recognition" title="Awards" showDescription={false} />
      <AwardsSection variant="page" />
    </main>
  );
}
