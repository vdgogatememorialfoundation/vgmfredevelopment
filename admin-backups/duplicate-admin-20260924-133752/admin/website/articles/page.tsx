"use client";

export default function AdminPage() {
  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">
            Website & CMS
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Website Articles
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Manage articles displayed on the public website.
          </p>
        </div>

      <div className="flex items-center gap-3">
        <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Export
        </button>

        <a
          href="/admin/articles/new"
          className="rounded-xl bg-[#651C1C] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4F1414]"
        >
          + New Article
        </a>
      </div>

      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            0
          </p>
          <p className="mt-1 text-xs text-slate-400">
            All records
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active
          </p>
          <p className="mt-3 text-3xl font-bold text-green-700">
            0
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Active records
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Pending
          </p>
          <p className="mt-3 text-3xl font-bold text-amber-600">
            0
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Awaiting action
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            This Month
          </p>
          <p className="mt-3 text-3xl font-bold text-[#651C1C]">
            0
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Current month
          </p>
        </div>

      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">

          <div>
            <h2 className="font-bold text-slate-900">
              Website Articles
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Manage Website Articles.ToLower() from this administration module.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="search"
              placeholder="Search..."
              className="w-52 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#651C1C]"
            />

            <button className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
              Filter
            </button>
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[800px]">

            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Name / ID
                </th>

                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Status
                </th>

                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Created
                </th>

                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Updated
                </th>

                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center">

                  <div className="mx-auto max-w-md">

                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F1EA] text-2xl text-[#651C1C]">
                      +
                    </div>

                    <h3 className="mt-5 text-lg font-bold text-slate-900">
                      No records yet
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Records created through this module will appear here.
                    </p>

                    <div className="mt-5 flex justify-center gap-3">

                      <button className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                        Refresh
                      </button>

                                            <a
                        href="/admin/articles/new"
                        className="rounded-xl bg-[#651C1C] px-4 py-2.5 text-sm font-bold text-white"
                      >
                        + New Article
                      </a>

                    </div>

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
