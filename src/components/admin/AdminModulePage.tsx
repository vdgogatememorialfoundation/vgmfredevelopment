"use client";

import Link from "next/link";

type AdminModulePageProps = {
  title: string;
  description: string;
  section: string;
  action?: string;
  actionHref?: string;
  stats?: {
    label: string;
    value: string;
  }[];
  columns?: string[];
};

export default function AdminModulePage({
  title,
  description,
  section,
  action,
  actionHref,
  stats = [],
  columns = ["Name", "Status", "Created", "Actions"],
}: AdminModulePageProps) {
  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">
            {section}
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>

        {action && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center rounded-xl bg-[#651C1C] px-5 py-3 text-sm font-bold text-white hover:bg-[#4F1414]"
          >
            + {action}
          </Link>
        )}
      </div>

      {stats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-xs font-medium text-slate-400">
                {stat.label}
              </p>

              <p className="mt-3 text-2xl font-bold text-slate-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Manage {title.toLowerCase()} from this section.
            </p>
          </div>

          <input
            placeholder="Search..."
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#651C1C]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-400"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-16 text-center"
                >
                  <div className="mx-auto max-w-md">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F3ED] text-xl text-[#651C1C]">
                      +
                    </div>

                    <p className="mt-4 font-semibold text-slate-800">
                      No records yet
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Records created through this module will appear here.
                    </p>

                    {action && actionHref && (
                      <Link
                        href={actionHref}
                        className="mt-5 inline-flex rounded-xl border border-[#651C1C] px-4 py-2 text-sm font-semibold text-[#651C1C]"
                      >
                        Create {action}
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
