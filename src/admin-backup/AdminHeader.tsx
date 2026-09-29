"use client";

import { useState } from "react";

export default function AdminHeader() {

  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">

      <div className="pl-12 lg:pl-0">

        <p className="text-xs font-medium text-slate-400">
          Administration
        </p>

        <p className="text-sm font-bold text-slate-900">
          Vaidya Gogate Memorial Foundation
        </p>

      </div>

      <div className="flex items-center gap-3 sm:gap-4">

        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="hidden rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 sm:block"
        >
          Search
        </button>

        <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50">
          🔔

          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#651C1C]" />
        </button>

        <div className="hidden text-right sm:block">

          <p className="text-sm font-semibold text-slate-900">
            Administrator
          </p>

          <p className="text-xs text-slate-400">
            Super Administrator
          </p>

        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#651C1C] text-sm font-bold text-white">
          A
        </div>

      </div>

      {searchOpen && (
        <div className="absolute right-5 top-16 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">

          <input
            autoFocus
            placeholder="Search administration..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#651C1C]"
          />

        </div>
      )}

    </header>
  );
}
