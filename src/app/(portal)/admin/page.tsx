"use client"

import Link from "next/link"

const cards = [
  {
    title: "Commerce",
    description: "Orders, shipments, products, inventory and payments.",
    href: "/admin/commerce/orders",
  },
  {
    title: "Website & CMS",
    description: "Homepage, articles, announcements, media and videos.",
    href: "/admin/website/homepage",
  },
  {
    title: "Events",
    description: "Events, registrations, applications, tickets and attendance.",
    href: "/admin/events",
  },
  {
    title: "Certificates",
    description: "Issue, reissue and verify Foundation certificates.",
    href: "/admin/certificates",
  },
  {
    title: "Payments",
    description: "Transactions, refunds and reconciliation.",
    href: "/admin/payments",
  },
  {
    title: "Support",
    description: "Support tickets and contact enquiries.",
    href: "/admin/support",
  },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-8">

      <div>
        <p className="text-sm font-medium text-[#651C1C]">
          Vaidya Gogate Memorial Foundation
        </p>

        <h1 className="mt-1 text-3xl font-semibold text-gray-900">
          Admin Dashboard
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Manage the VGMF website, events, commerce, certificates,
          payments, accounts, communication and delivery operations.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-[#4F1414]">
              {card.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              {card.description}
            </p>

            <div className="mt-5 text-sm font-medium text-[#651C1C]">
              Open module →
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">VGMF Administration</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Orders
            </div>
            <div className="mt-1 text-2xl font-semibold">0</div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Events
            </div>
            <div className="mt-1 text-2xl font-semibold">0</div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Registrations
            </div>
            <div className="mt-1 text-2xl font-semibold">0</div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Certificates
            </div>
            <div className="mt-1 text-2xl font-semibold">0</div>
          </div>
        </div>
      </div>

    </div>
  )
}
