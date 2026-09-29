import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">

      <div className="text-center">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F0E8] text-xl font-bold text-[#651C1C]">
          404
        </div>

        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          Administration page not found
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          The administration page you requested does not exist.
        </p>

        <Link
          href="/admin"
          className="mt-6 inline-flex rounded-xl bg-[#651C1C] px-5 py-3 text-sm font-semibold text-white"
        >
          Back to Dashboard
        </Link>

      </div>

    </div>
  );
}
