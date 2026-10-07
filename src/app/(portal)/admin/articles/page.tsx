"use client";

import Link from "next/link";
import { SiteCatalog } from "@/components/admin/SiteModules";

export default function ArticlesAdmin() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/admin/articles/new"
          className="rounded-lg bg-[#651C1C] px-4 py-2 text-sm font-medium text-white"
        >
          + Create Article
        </Link>
      </div>
      <SiteCatalog moduleId="articles" />
    </div>
  );
}
