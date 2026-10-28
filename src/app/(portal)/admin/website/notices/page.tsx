"use client";

import RecordDesk from "@/components/admin/RecordDesk";
import { hideNotice, saveNotice } from "@/lib/cms";
import { useLiveNotices } from "@/lib/use-cms";
import type { Notice } from "@/types";

export default function Page() {
  const records = useLiveNotices();
  return (
    <RecordDesk<Notice>
      heading="Notice board"
      description="Notices saved here appear on the homepage notice board and on /notices."
      publicHref="/notices"
      records={records}
      label={(record) => record.title}
      fields={[
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "description", label: "Description", kind: "textarea" },
        { key: "href", label: "Link" },
        { key: "date", label: "Date" },
      ]}
      blank={() => ({
        id: `ntc-${Date.now()}`,
        title: "",
        category: "Notice",
        description: "",
        href: "/notices",
        date: new Date().toISOString().slice(0, 10),
      })}
      onSave={(record) => saveNotice({ ...record, href: record.href || "/notices" })}
      onHide={hideNotice}
    />
  );
}
