"use client"

import Link from "next/link"

const modules = [
  ["All Events", "/admin/events"],
  ["Create Event", "/admin/events/create"],
  ["Registrations", "/admin/events/registrations"],
  ["Applications", "/admin/events/applications"],
  ["Speakers", "/admin/events/speakers"],
  ["Schedule", "/admin/events/schedule"],
  ["Payments", "/admin/events/payments"],
  ["Tickets", "/admin/events/tickets"],
  ["Attendance", "/admin/events/attendance"],
  ["Certificates", "/admin/events/certificates"],
]

export default function EventsAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#4F1414]">
          Events
        </h1>

        <p className="mt-1 text-sm text-gray-600">
          Create and manage VGMF seminars, events, registrations,
          applications, speakers, schedules, tickets, attendance
          and event certificates.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border bg-white p-5 hover:border-[#651C1C] hover:shadow-sm"
          >
            <div className="font-semibold text-[#4F1414]">
              {label}
            </div>

            <div className="mt-2 text-sm text-gray-500">
              Open {label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
