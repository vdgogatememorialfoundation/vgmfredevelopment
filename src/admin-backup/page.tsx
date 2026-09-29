"use client";

import Link from "next/link";

const stats = [
  ["Total Customers", "2,430", "+12.4%"],
  ["Staff Accounts", "18", "+2"],
  ["Active Events", "12", "+3"],
  ["Event Registrations", "1,284", "+18.2%"],
  ["Orders", "184", "+9.6%"],
  ["Shipments", "162", "+7.8%"],
  ["Payments", "₹4.82L", "+14.3%"],
  ["Open Tickets", "24", "-8.1%"],
];

const events = [
  ["National Seminar 2026", "28 Sep 2026", "742", "Registration Open"],
  ["Ayurveda Research Workshop", "12 Oct 2026", "186", "Registration Open"],
  ["Viddhakarma Fellowship", "25 Oct 2026", "356", "Applications"],
];

export default function AdminDashboard() {

  return (
    <div className="space-y-8">

      <div>

        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">
          Dashboard
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Overview
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Central administration dashboard for Vaidya Gogate Memorial Foundation.
          Monitor accounts, events, website, commerce, payments, shipments and support.
        </p>

      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {stats.map(([label, value, change]) => (

          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >

            <p className="text-xs font-medium text-slate-400">
              {label}
            </p>

            <div className="mt-3 flex items-end justify-between">

              <p className="text-2xl font-bold text-slate-900">
                {value}
              </p>

              <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">
                {change}
              </span>

            </div>

          </div>

        ))}

      </div>

      <div className="grid gap-6 xl:grid-cols-3">

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">

          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

            <div>

              <h2 className="font-bold text-slate-900">
                Upcoming Events
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Current event activity
              </p>

            </div>

            <Link
              href="/admin/events"
              className="text-sm font-semibold text-[#651C1C]"
            >
              View all
            </Link>

          </div>

          <div className="divide-y divide-slate-100">

            {events.map(([name, date, registrations, status]) => (

              <div
                key={name}
                className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
              >

                <div>

                  <p className="font-semibold text-slate-900">
                    {name}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {date}
                  </p>

                </div>

                <div className="flex items-center gap-5">

                  <div className="text-right">

                    <p className="font-semibold text-slate-900">
                      {registrations}
                    </p>

                    <p className="text-xs text-slate-400">
                      registrations
                    </p>

                  </div>

                  <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                    {status}
                  </span>

                </div>

              </div>

            ))}

          </div>

        </section>

        <section className="rounded-2xl border border-slate-200 bg-white">

          <div className="border-b border-slate-100 px-6 py-5">

            <h2 className="font-bold text-slate-900">
              Quick Actions
            </h2>

          </div>

          <div className="grid gap-3 p-5">

            <Action
              title="Create Event"
              href="/admin/events/create"
            />

            <Action
              title="Publish Article"
              href="/admin/articles/new"
            />

            <Action
              title="Add Announcement"
              href="/admin/website/announcements/new"
            />

            <Action
              title="Create Shipment"
              href="/admin/shipments/create"
            />

            <Action
              title="Create Staff Account"
              href="/admin/accounts/staff"
            />

          </div>

        </section>

      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="border-b border-slate-100 px-6 py-5">

          <h2 className="font-bold text-slate-900">
            Operations
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            Current operational workload
          </p>

        </div>

        <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">

          <Operation
            title="Support Tickets"
            value="24"
            status="8 awaiting response"
          />

          <Operation
            title="Pending Payments"
            value="17"
            status="Requires review"
          />

          <Operation
            title="Pending Shipments"
            value="11"
            status="Ready for processing"
          />

          <Operation
            title="Seller Applications"
            value="7"
            status="Awaiting approval"
          />

        </div>

      </section>

    </div>
  );
}

function Action({
  title,
  href,
}: {
  title: string;
  href: string;
}) {

  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-900 hover:border-[#DCC9B5] hover:bg-[#FFFDF9]"
    >
      {title}

      <span className="float-right text-slate-300">
        →
      </span>
    </Link>
  );
}

function Operation({
  title,
  value,
  status,
}: {
  title: string;
  value: string;
  status: string;
}) {

  return (
    <div className="px-6 py-6">

      <p className="text-xs font-medium text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {status}
      </p>

    </div>
  );
}
