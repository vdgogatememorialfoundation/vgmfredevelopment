"use client";

import Link from "next/link";

const links = [
  ["Videos", "/admin/website/videos", "/videos"],
  ["Gallery", "/admin/website/gallery", "/gallery"],
  ["Slideshow images", "/admin/website/flyers", "/"],
  ["Banners", "/admin/website/banners", "/"],
  ["Articles", "/admin/articles", "/articles"],
];

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Media library</h1>
      <p className="text-sm text-slate-500">Each library opens the admin screen that publishes that part of the public site.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {links.map(([label, adminHref, publicHref]) => (
          <div key={adminHref} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="font-semibold text-slate-900">{label}</p>
            <div className="mt-3 flex gap-4 text-sm font-semibold">
              <Link href={adminHref} className="text-burgundy">Manage</Link>
              <Link href={publicHref} className="text-slate-500">View on the site</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
