"use client";

import Link from "next/link";
import { useLiveNotices } from "@/lib/use-cms";

function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function noticeFile(notice: { attachment?: string; href: string }) {
  if (!notice.attachment) return null;
  if (/^(https?:|\/|data:)/.test(notice.attachment)) return notice.attachment;
  return notice.href;
}

const PINNED = ["ntc-home-001", "ntc-home-002", "ntc-home-003"];

export default function NoticeBoard() {
  const all = useLiveNotices();
  const pinned = PINNED.map((id) => all.find((notice) => notice.id === id)).filter(Boolean) as typeof all;
  const notices = (pinned.length ? pinned : all).slice(0, 3);

  return (
    <section className="bg-background py-8" aria-labelledby="notices-heading">
      <div className="container">
        <div className="mx-auto max-w-xl rounded-[28px] border border-border bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-text-primary" aria-hidden="true">
              <path d="M3 11v2a1 1 0 0 0 1 1h1.5l6 4.5V5.5L5.5 10H4a1 1 0 0 0-1 1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M16 8.2a4.8 4.8 0 0 1 0 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <h2 id="notices-heading" className="text-sm font-semibold text-text-primary">
              Official notices
            </h2>
          </div>

          <ul className="space-y-3">
            {notices.map((notice) => {
              const file = noticeFile(notice);
              return (
                <li
                  key={notice.id}
                  className="rounded-2xl border-l-[3px] border-burgundy bg-[#F4FBF7] px-4 py-3.5"
                >
                  <p className="text-sm font-semibold leading-5 text-text-primary">{notice.title}</p>
                  {notice.description ? (
                    <p className="mt-1 text-xs leading-5 text-text-muted">{notice.description}</p>
                  ) : null}
                  {file ? (
                    <a
                      href={file}
                      target={file.startsWith("http") ? "_blank" : undefined}
                      rel={file.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      <PdfIcon />
                      Download PDF
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="mt-3 text-center">
          <Link href="/notices" className="text-xs font-medium text-burgundy hover:underline">
            All notices
          </Link>
        </p>
      </div>
    </section>
  );
}
