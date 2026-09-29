import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">

      <div className="text-center">

        <p className="text-5xl font-bold text-[#651C1C]">
          404
        </p>

        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Admin page not found
        </h1>

        <Link
          href="/admin"
          className="mt-6 inline-block rounded-xl bg-[#651C1C] px-5 py-3 text-sm font-bold text-white"
        >
          Back to Dashboard
        </Link>

      </div>

    </div>
  );
}
