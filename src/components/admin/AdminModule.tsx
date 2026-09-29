"use client";

import Link from "next/link";

type AdminModuleProps = {
  section: string;
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
};

export default function AdminModule({
  section,
  title,
  description,
  action,
  actionHref,
}: AdminModuleProps) {
  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#651C1C]">
            {section}
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {title}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>

        </div>

        {action && actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center rounded-xl bg-[#651C1C] px-5 py-3 text-sm font-bold text-white hover:bg-[#4F1414]"
          >
            + {action}
          </Link>
        ) : null}

      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            0
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active
          </p>
          <p className="mt-3 text-3xl font-bold text-green-700">
            0
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Pending
          </p>
          <p className="mt-3 text-3xl font-bold text-amber-600">
            0
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            This Month
          </p>
          <p className="mt-3 text-3xl font-bold text-[#651C1C]">
            0
          </p>
        </div>

      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">

          <div>
            <h2 className="font-bold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Manage {title.toLowerCase()} from the VGMF administration console.
            </p>
          </div>

          <div className="flex gap-2">

            <input
              type="search"
              placeholder="Search..."
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#651C1C]"
            />

            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Filter
            </button>

          </div>

        </div>

        <div className="px-6 py-20 text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F1EA] text-2xl text-[#651C1C]">
            +
          </div>

          <h3 className="mt-5 font-bold text-slate-900">
            No records yet
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Records created through this module will appear here.
          </p>

          {action && actionHref ? (
            <Link
              href={actionHref}
              className="mt-5 inline-flex rounded-xl bg-[#651C1C] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4F1414]"
            >
              + {action}
            </Link>
          ) : null}

        </div>

      </div>

    </div>
  );
}
