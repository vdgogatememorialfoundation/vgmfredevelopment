"use client";

import Link from "next/link";
import { EventAdminList } from "@/components/admin/PublishingDesk";

const modules = [
  ["Registrations", "/admin/events/registrations"],
  ["Applications", "/admin/events/applications"],
  ["Speakers", "/admin/events/speakers"],
  ["Schedule", "/admin/events/schedule"],
  ["Payments", "/admin/events/payments"],
  ["Tickets", "/admin/events/tickets"],
  ["Attendance", "/admin/events/attendance"],
  ["Certificates", "/admin/events/certificates"],
];

export default function EventsAdmin() {
  return (
    <div className="space-y-8">
      <EventAdminList />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border bg-white p-5 hover:border-[#651C1C] hover:shadow-sm"
          >
            <div className="font-semibold text-[#4F1414]">{label}</div>
            <div className="mt-2 text-sm text-gray-500">Open {label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
