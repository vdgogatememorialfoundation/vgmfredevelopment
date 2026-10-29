"use client";

import Link from "next/link";
import { EventAdminList } from "@/components/admin/PublishingDesk";

export default function EventsAdmin() {
  return (
    <div className="space-y-8">
      <EventAdminList />
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/events/schedule" className="rounded-xl border bg-white p-5 hover:border-burgundy hover:shadow-sm">
          <div className="font-semibold text-burgundy-dark">Schedule</div>
          <div className="mt-2 text-sm text-gray-500">Session times for each event.</div>
        </Link>
        <Link href="/admin/events/speakers" className="rounded-xl border bg-white p-5 hover:border-burgundy hover:shadow-sm">
          <div className="font-semibold text-burgundy-dark">Speakers</div>
          <div className="mt-2 text-sm text-gray-500">Speaker names and topics.</div>
        </Link>
      </div>
    </div>
  );
}
