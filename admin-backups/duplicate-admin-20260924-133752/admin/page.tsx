"use client";

import Link from "next/link";

const cards = [
  ["Orders", "0", "/admin/shipments/orders"],
  ["Products", "0", "/admin/products"],
  ["Sellers", "0", "/admin/sellers"],
  ["Customers", "0", "/admin/accounts/customers"],
  ["Events", "0", "/admin/events"],
  ["Registrations", "0", "/admin/events/registrations"],
  ["Payments", "0", "/admin/payments"],
  ["Certificates", "0", "/admin/certificates"],
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8">

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#651C1C]">
          VGMF Administration
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Welcome, Admin
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Complete administration console for Vaidya Gogate Memorial Foundation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {cards.map(([label, value, href]) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#D7C1AA] hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {label}
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {value}
            </p>

            <p className="mt-2 text-xs font-semibold text-[#651C1C]">
              Open module →
            </p>
          </Link>
        ))}

      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">

        <h2 className="text-lg font-bold text-slate-900">
          Quick Actions
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <Link
            href="/admin/events/create"
            className="rounded-xl border border-slate-200 p-4 font-semibold hover:bg-[#F8F1EA]"
          >
            + Create Event
          </Link>

          <Link
            href="/admin/articles/new"
            className="rounded-xl border border-slate-200 p-4 font-semibold hover:bg-[#F8F1EA]"
          >
            + Publish Article
          </Link>

          <Link
            href="/admin/certificates/issue"
            className="rounded-xl border border-slate-200 p-4 font-semibold hover:bg-[#F8F1EA]"
          >
            + Issue Certificate
          </Link>

          <Link
            href="/admin/shipments/create"
            className="rounded-xl border border-slate-200 p-4 font-semibold hover:bg-[#F8F1EA]"
          >
            + Create Shipment
          </Link>

        </div>

      </div>

    </div>
  );
}
