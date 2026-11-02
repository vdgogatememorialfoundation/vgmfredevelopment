import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import { SpeakerBoard } from "@/components/events/EventSchedules";

export const metadata: Metadata = {
  title: "Speakers",
  description: "Speakers fetched from the seminar and autism programme schedules.",
};

export default function SpeakersPage() {
  return (
    <main>
      <PageHeader eyebrow="Faculty" title="Speakers" showDescription={false} />
      <SpeakerBoard variant="page" />
    </main>
  );
}
