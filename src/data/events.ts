import type { Event } from "@/types";

export const events: Event[] = [];

export function getEventBySlug(slug: string) {
  return events.find((event) => event.slug === slug);
}

export function getUpcomingEvents() {
  return events.filter((event) => event.registrationStatus !== "Closed");
}
