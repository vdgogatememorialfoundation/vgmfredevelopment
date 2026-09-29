"use client";

import Link from "next/link";

export default function AdminHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">

      <div className="flex h-16 items-center justify-between px-5 lg:px-8">

        <div>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#651C1C]">
            VGMF
          </p>

          <p className="text-sm font-semibold text-slate-800">
            Foundation Administration
          </p>

        </div>

        <div className="flex items-center gap-3">

          <span className="hidden rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 sm:block">
            Site Live
          </span>

          <Link
            href="/"
            target="_blank"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            View Website
          </Link>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#651C1C] text-sm font-bold text-white">
            A
          </div>

        </div>

      </div>

    </header>
  );
}
