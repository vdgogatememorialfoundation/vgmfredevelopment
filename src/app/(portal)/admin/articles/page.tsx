"use client"

import Link from "next/link"

export default function ArticlesAdmin() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#4F1414]">
            Articles
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Create, edit, publish and manage articles displayed on
            the VGMF public website.
          </p>
        </div>

        <Link
          href="/admin/articles/new"
          className="rounded-lg bg-[#651C1C] px-4 py-2 text-sm font-medium text-white"
        >
          + Create Article
        </Link>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="font-semibold">Article Management</h2>
        </div>

        <div className="p-5 text-sm text-gray-500">
          Articles created here should be published to
          <span className="mx-1 font-medium text-[#651C1C]">
            /articles
          </span>
          on the main VGMF website.
        </div>
      </div>
    </div>
  )
}
