"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import { filterNotices, noticeCategories, noticeFileHref, noticeHasFile, noticeYears } from "@/lib/notice-display";
import { useMergedNotices } from "@/lib/use-notices";
import { formatDate } from "@/lib/utils";
import type { AnyNotice } from "@/lib/notice-display";

const kinds = [
  { id: "all", label: "All" },
  { id: "pinned", label: "Pinned" },
  { id: "file", label: "With file" },
  { id: "text", label: "Text only" },
];

export function NoticesGazette() {
  const { notices } = useMergedNotices();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState("all");
  const [year, setYear] = useState("all");
  const [copied, setCopied] = useState("");

  const categories = useMemo(() => noticeCategories(notices), [notices]);
  const years = useMemo(() => noticeYears(notices), [notices]);
  const shown = useMemo(
    () => filterNotices(notices, { q, category, kind, year }),
    [notices, q, category, kind, year]
  );

  const copyLink = async (notice: AnyNotice) => {
    const url = `${window.location.origin}/notices#${notice.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(notice.id);
    window.setTimeout(() => setCopied(""), 2000);
  };

  return (
    <main>
      <PageHeader
        eyebrow="Official gazette"
        title="Notice board"
        description="Circulars, deadlines and lists published by the Foundation. Text-only notices and notices with a file both appear here after they are posted from Admin → Website → Notice Board."
        breadcrumb={[{ name: "Notices", href: "/notices" }]}
      />
      <section className="section-paper">
        <div className="container grid gap-8 lg:grid-cols-[16rem_1fr]">
          <aside className="h-fit space-y-4 rounded-xl border border-stone-300 bg-white p-4 lg:sticky lg:top-28">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Search
              <input
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-ink"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Title or wording"
              />
            </label>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Kind</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {kinds.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setKind(item.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      kind === item.id ? "border-ink bg-ink text-white" : "border-stone-300 text-ink hover:border-gold"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Category
              <select className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Year
              <select className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="all">All years</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <a href="mailto:info@vaidyagogate.org?subject=Notice%20board%20alert" className="block text-xs font-semibold text-burgundy hover:underline">
              Email the office about a notice
            </a>
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-stone-600">
                Showing <span className="font-semibold text-ink">{shown.length}</span> of {notices.length} notices
              </p>
              <button type="button" className="text-xs font-semibold text-ink underline-offset-2 hover:underline" onClick={() => window.print()}>
                Print this page
              </button>
            </div>
            {shown.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
                No notices match those filters.
              </div>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-stone-300 bg-white">
                {shown.map((notice) => {
                  const file = noticeFileHref(notice);
                  return (
                    <li key={notice.id} id={notice.id} className="border-b border-stone-200 px-5 py-5 last:border-b-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <time dateTime={notice.date}>{formatDate(notice.date)}</time>
                        <span className="rounded bg-paper px-2 py-0.5 font-semibold uppercase tracking-wider text-gold">{notice.category}</span>
                        {notice.pinned ? <span className="font-semibold uppercase tracking-wider text-ink">Pinned</span> : null}
                        <span>{noticeHasFile(notice) ? "File attached" : "Text only"}</span>
                      </div>
                      <h2 className="mt-2 font-serif text-lg font-semibold text-ink">{notice.title}</h2>
                      {notice.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{notice.description}</p> : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
                        {file ? (
                          <a href={file} className="rounded-md border border-stone-300 px-3 py-1.5 text-ink hover:border-gold">
                            {notice.fileName ? `Download ${notice.fileName}` : "Download file"}
                          </a>
                        ) : null}
                        {notice.href && notice.href !== "/notices" && notice.href !== `/notices#${notice.id}` ? (
                          <Link href={notice.href} className="text-burgundy hover:underline">
                            Related page
                          </Link>
                        ) : null}
                        <button type="button" className="text-ink hover:underline" onClick={() => void copyLink(notice)}>
                          {copied === notice.id ? "Link copied" : "Copy link"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
