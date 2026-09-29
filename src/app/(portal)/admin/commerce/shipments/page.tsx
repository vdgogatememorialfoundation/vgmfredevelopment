"use client"

import Link from "next/link"

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#4F1414]">Shipment Management</h1>
        <p className="mt-1 text-sm text-gray-600">Create and manage shipments, tracking, AWB and delivery status.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Total</p>
          <p className="mt-2 text-3xl font-semibold">0</p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-2 text-3xl font-semibold">0</p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="mt-2 text-3xl font-semibold">0</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">Management</h2>
        <p className="mt-2 text-sm text-gray-600">
          This module is ready to be connected to the VGMF database/API.
        </p>

        <div className="mt-5 flex gap-3">
          <Link
            href="/admin"
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
