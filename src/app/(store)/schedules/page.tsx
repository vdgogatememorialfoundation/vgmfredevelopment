import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import EventSchedules from "@/components/events/EventSchedules";

export const metadata: Metadata = {
  title: "Event schedules",
  description: "Session start and end times for programmes published on the seminar and autism portals.",
};

export default function SchedulesPage() {
  return (
    <main>
      <PageHeader eyebrow="Programmes" title="Event schedules" showDescription={false} />
      <EventSchedules variant="page" />
    </main>
  );
}
