"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import { filterNotices, noticeCategories, noticeFileHref, noticeHasFile, noticeYears } from "@/lib/notice-display";
import { useMergedNotices } from "@/lib/use-notices";
import { formatDate } from "@/lib/utils";
import type { AnyNotice } from "@/lib/notice-display";
import { useI18n } from "@/components/i18n/LanguageProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const kinds: { id: string; label: MessageKey }[] = [
  { id: "all", label: "notice.all" },
  { id: "pinned", label: "notice.pinned" },
  { id: "file", label: "notice.withFile" },
  { id: "text", label: "notice.textOnly" },
];

export function NoticesGazette() {
  const { t } = useI18n();
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
        eyebrow={t("notice.pageEyebrow")}
        title={t("notice.pageTitle")}
        description={t("notice.pageDesc")}
        breadcrumb={[{ name: t("nav.notices"), href: "/notices" }]}
      />
      <section className="section-paper">
        <div className="container grid gap-8 lg:grid-cols-[16rem_1fr]">
          <aside className="h-fit space-y-4 rounded-xl border border-border bg-white p-4 lg:sticky lg:top-28">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("notice.search")}
              <input
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t("notice.searchPlaceholder")}
              />
            </label>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t("notice.kind")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {kinds.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setKind(item.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      kind === item.id ? "border-ink bg-ink text-white" : "border-border text-ink hover:border-burgundy"
                    }`}
                  >
                    {t(item.label)}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("notice.category")}
              <select className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">{t("notice.allCategories")}</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("notice.year")}
              <select className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="all">{t("notice.allYears")}</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <a href="mailto:info@vaidyagogate.org?subject=Notice%20board%20alert" className="block text-xs font-semibold text-burgundy hover:underline">
              {t("notice.emailOffice")}
            </a>
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-muted">
                {t("notice.showing")} <span className="font-semibold text-ink">{shown.length}</span> {t("notice.of")} {notices.length}
              </p>
              <button type="button" className="text-xs font-semibold text-ink underline-offset-2 hover:underline" onClick={() => window.print()}>
                {t("notice.print")}
              </button>
            </div>
            {shown.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center text-sm text-text-muted">
                {t("notice.emptyFilter")}
              </div>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border bg-white">
                {shown.map((notice) => {
                  const file = noticeFileHref(notice);
                  return (
                    <li key={notice.id} id={notice.id} className="border-b border-border px-5 py-5 last:border-b-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <time dateTime={notice.date}>{formatDate(notice.date)}</time>
                        <span className="rounded bg-paper px-2 py-0.5 font-semibold uppercase tracking-wider text-burgundy">{notice.category}</span>
                        {notice.pinned ? <span className="font-semibold uppercase tracking-wider text-ink">{t("notice.pinned")}</span> : null}
                        <span>{noticeHasFile(notice) ? t("notice.fileAttached") : t("notice.textOnly")}</span>
                      </div>
                      <h2 className="mt-2 font-serif text-lg font-semibold text-ink">{notice.title}</h2>
                      {notice.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{notice.description}</p> : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
                        {file ? (
                          <a href={file} className="rounded-md border border-border px-3 py-1.5 text-ink hover:border-burgundy">
                            {notice.fileName ? `${t("notice.download")} ${notice.fileName}` : t("notice.download")}
                          </a>
                        ) : null}
                        {notice.href && notice.href !== "/notices" && notice.href !== `/notices#${notice.id}` ? (
                          <Link href={notice.href} className="text-burgundy hover:underline">
                            {t("notice.related")}
                          </Link>
                        ) : null}
                        <button type="button" className="text-ink hover:underline" onClick={() => void copyLink(notice)}>
                          {copied === notice.id ? t("notice.linkCopied") : t("notice.copyLink")}
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
