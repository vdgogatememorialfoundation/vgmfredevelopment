import type { Metadata } from "next";
import { EventsIndex } from "@/components/events/LiveEvents";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Seminars, conferences, workshops, webinars, fellowships and training programmes from Vaidya Gogate Memorial Foundation.",
};

export default function EventsPage() {
  return <EventsIndex />;
}
