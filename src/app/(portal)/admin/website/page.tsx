"use client"

import Link from "next/link"

const modules = [
  ["Homepage", "/admin/website/homepage"],
  ["Announcements", "/admin/website/announcements"],
  ["Notice Board", "/admin/website/notices"],
  ["Flyers", "/admin/website/flyers"],
  ["Banners", "/admin/website/banners"],
  ["Media Library", "/admin/website/media"],
  ["Articles", "/admin/articles"],
  ["Videos", "/admin/website/videos"],
]

export default function WebsiteAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#4F1414]">
          Website & CMS
        </h1>

        <p className="mt-1 text-sm text-gray-600">
          Manage the content displayed across the VGMF public website.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              Manage {label.toLowerCase()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
