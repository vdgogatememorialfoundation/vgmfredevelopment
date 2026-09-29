import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import EventCard from "@/components/events/EventCard";
import RequireAuth from "@/components/auth/RequireAuth";
import { getEvents } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Seminars, conferences, workshops, webinars, fellowships and training programmes from Vaidya Gogate Memorial Foundation.",
};

export default async function EventsPage() {
  const events = await getEvents();
  const upcoming = events
    .filter((event) => event.registrationStatus !== "Closed")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = events
    .filter((event) => event.registrationStatus === "Closed")
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <RequireAuth message="Sign in to view Foundation events.">
      <main>
      <PageHeader
        eyebrow="Events"
        title="Events & Programmes"
        description="Seminars, workshops, fellowships and other programmes of the Foundation. Registrations are handled on the official seminar website."
      />

      <section className="section bg-background">
        <div className="container">
          <h2 className="heading-3 mb-8">Upcoming Events</h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.length > 0 ? (
              upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))
            ) : (
              <p className="text-text-muted">
                No upcoming events at the moment. Please check back soon.
              </p>
            )}
          </div>
        </div>
      </section>

      {past.length > 0 && (
        <section className="section bg-warm-cream">
          <div className="container">
            <h2 className="heading-3 mb-8">Past Events</h2>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {past.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
    </RequireAuth>
  );
}