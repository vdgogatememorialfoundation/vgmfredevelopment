"use client";

import { noticeFileHref, noticeHasFile } from "@/lib/notice-display";
import { useMergedNotices } from "@/lib/use-notices";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function NoticeBoard() {
  const { notices: all } = useMergedNotices();
  const { t } = useI18n();
  const pinned = all.filter((notice) => notice.pinned);
  const notices = (pinned.length ? pinned : all).slice(0, 4);

  return (
    <section id="notices" className="border-t border-border bg-paper py-6" aria-labelledby="notices-heading">
      <div className="container">
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-burgundy">{t("home.noticeEyebrow")}</p>
              <h2 id="notices-heading" className="font-serif text-base font-semibold text-ink">
                {t("home.noticeBoard")}
              </h2>
            </div>
          </div>
          {notices.length === 0 ? (
            <p className="px-4 py-5 text-sm text-text-muted">{t("home.noticeEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {notices.map((notice) => {
                const file = noticeFileHref(notice);
                return (
                  <li key={notice.id} id={notice.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-text-muted">
                        {formatDate(notice.date)}
                        {notice.category ? ` · ${notice.category}` : ""}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-ink">{notice.title}</p>
                      {notice.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-text-muted">{notice.description}</p>
                      ) : null}
                    </div>
                    {file || noticeHasFile(notice) ? (
                      <a
                        href={file || `/api/notices/${notice.id}/file`}
                        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-burgundy hover:text-burgundy"
                      >
                        {t("notice.download")}
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
