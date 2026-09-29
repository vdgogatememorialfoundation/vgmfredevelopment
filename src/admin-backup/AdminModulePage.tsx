"use client";

import { useState } from "react";

type Row = {
  id: string;
  name: string;
  status: string;
  date: string;
};

const demoRows: Row[] = [
  {
    id: "VGMF-001",
    name: "National Seminar 2026",
    status: "Active",
    date: "24 Sep 2026",
  },
  {
    id: "VGMF-002",
    name: "Ayurveda Research Workshop",
    status: "Pending",
    date: "23 Sep 2026",
  },
  {
    id: "VGMF-003",
    name: "Viddhakarma Fellowship",
    status: "Active",
    date: "22 Sep 2026",
  },
  {
    id: "VGMF-004",
    name: "Website Contact",
    status: "Open",
    date: "21 Sep 2026",
  },
];

export default function AdminModulePage({
  title,
  description,
  actionLabel = "Create New",
}: {
  title: string;
  description: string;
  actionLabel?: string;
}) {

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filtered = demoRows.filter((row) =>
    `${row.id} ${row.name} ${row.status}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-7">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#651C1C]">
            Administration
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>

        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-[#651C1C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#4F1414]"
        >
          + {actionLabel}
        </button>

      </div>

      {showForm && (

        <section className="rounded-2xl border border-slate-200 bg-white p-6">

          <h2 className="text-lg font-bold text-slate-900">
            {actionLabel}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Enter the required information.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">

            <Field
              label="Name"
              placeholder="Enter name"
            />

            <Field
              label="Email"
              placeholder="Enter email"
            />

            <Field
              label="Phone"
              placeholder="Enter phone number"
            />

            <Field
              label="Status"
              placeholder="Active"
            />

            <div className="md:col-span-2">

              <Field
                label="Description"
                placeholder="Enter description"
                textarea
              />

            </div>

          </div>

          <div className="mt-6 flex gap-3">

            <button className="rounded-xl bg-[#651C1C] px-5 py-2.5 text-sm font-semibold text-white">
              Save
            </button>

            <button
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>

          </div>

        </section>

      )}

      <div className="grid gap-4 sm:grid-cols-3">

        <MiniStat
          label="Total"
          value="248"
        />

        <MiniStat
          label="Active"
          value="192"
        />

        <MiniStat
          label="Pending"
          value="56"
        />

      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">

          <div>

            <h2 className="font-bold text-slate-900">
              Records
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Manage records in this module.
            </p>

          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#651C1C]"
          />

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[700px] text-left">

            <thead className="bg-[#FAFAF8]">

              <tr>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  ID
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Name
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Date
                </th>

                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Action
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {filtered.map((row) => (

                <tr
                  key={row.id}
                  className="hover:bg-[#FFFDF9]"
                >

                  <td className="px-6 py-4 text-sm text-slate-500">
                    {row.id}
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {row.name}
                  </td>

                  <td className="px-6 py-4">

                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      {row.status}
                    </span>

                  </td>

                  <td className="px-6 py-4 text-sm text-slate-500">
                    {row.date}
                  </td>

                  <td className="px-6 py-4 text-right">

                    <button className="text-sm font-semibold text-[#651C1C]">
                      View
                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}

function Field({
  label,
  placeholder,
  textarea = false,
}: {
  label: string;
  placeholder: string;
  textarea?: boolean;
}) {

  return (
    <div>

      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      {textarea ? (
        <textarea
          rows={4}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#651C1C]"
        />
      ) : (
        <input
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#651C1C]"
        />
      )}

    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">

      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>

    </div>
  );
}
