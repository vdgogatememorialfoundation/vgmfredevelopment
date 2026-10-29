"use client";

import Link from "next/link";
import { noticeFileHref, noticeHasFile } from "@/lib/notice-display";
import { useMergedNotices } from "@/lib/use-notices";
import { formatDate } from "@/lib/utils";

export default function NoticeBoard() {
  const { notices: all } = useMergedNotices();
  const pinned = all.filter((notice) => notice.pinned);
  const notices = (pinned.length ? pinned : all).slice(0, 6);

  return (
    <section className="border-t border-border bg-paper py-10" aria-labelledby="notices-heading">
      <div className="container">
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3 bg-ink px-5 py-4 text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">Official gazette</p>
              <h2 id="notices-heading" className="font-serif text-lg font-semibold">
                Notice board
              </h2>
            </div>
            <Link href="/notices" className="text-sm font-medium text-sky-100 hover:text-white">
              All notices
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {notices.map((notice) => {
              const file = noticeFileHref(notice);
              return (
                <li key={notice.id} id={notice.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[7rem_1fr_auto] sm:items-start">
                  <time className="text-xs font-medium text-text-muted" dateTime={notice.date}>
                    {formatDate(notice.date)}
                  </time>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-burgundy">{notice.category}</p>
                      {notice.pinned ? (
                        <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 font-serif text-sm font-semibold text-ink">{notice.title}</p>
                    {notice.description ? <p className="mt-1 text-sm leading-6 text-text-muted">{notice.description}</p> : null}
                  </div>
                  <div className="sm:text-right">
                    {file ? (
                      <a
                        href={file}
                        className="inline-flex items-center rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-burgundy hover:text-burgundy"
                      >
                        {notice.fileName ? `Download ${notice.fileName}` : "Download file"}
                      </a>
                    ) : noticeHasFile(notice) ? (
                      <a href={`/api/notices/${notice.id}/file`} className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-ink">
                        Download file
                      </a>
                    ) : (
                      <span className="text-xs text-text-muted">Text only</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
