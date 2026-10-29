import type { Notice } from "@/types";

export type PublicNotice = Notice & { hasFile?: boolean; fileUrl?: string; updatedAt?: string };
export type AnyNotice = Notice | PublicNotice;

const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|txt|png|jpe?g|webp|gif)$/i;

export function noticeHasFile(notice: AnyNotice) {
  if ("hasFile" in notice && notice.hasFile) return true;
  if ("fileUrl" in notice && notice.fileUrl) return true;
  const attachment = notice.attachment ?? "";
  if (!attachment) return false;
  if (/^(data:|https?:)/.test(attachment)) return true;
  return FILE_EXT.test(attachment);
}

export function noticeFileHref(notice: AnyNotice) {
  if ("fileUrl" in notice && notice.fileUrl) return notice.fileUrl;
  if (noticeHasFile(notice)) return `/api/notices/${notice.id}/file`;
  return null;
}

export function mergeNotices(remote: PublicNotice[] | null, local: Notice[]): AnyNotice[] {
  const byId = new Map<string, AnyNotice>();
  for (const notice of local) byId.set(notice.id, notice);
  for (const notice of remote ?? []) {
    const previous = byId.get(notice.id);
    byId.set(notice.id, previous ? { ...previous, ...notice } : notice);
  }
  return [...byId.values()].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`);
  });
}

export function noticeCategories(notices: AnyNotice[]) {
  return [...new Set(notices.map((notice) => notice.category).filter(Boolean))].sort();
}

export function noticeYears(notices: AnyNotice[]) {
  return [...new Set(notices.map((notice) => notice.date.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
}

export function filterNotices(
  notices: AnyNotice[],
  query: { q?: string; category?: string; kind?: string; year?: string }
) {
  const q = query.q?.trim().toLowerCase() ?? "";
  return notices.filter((notice) => {
    if (query.category && query.category !== "all" && notice.category !== query.category) return false;
    if (query.year && query.year !== "all" && notice.date.slice(0, 4) !== query.year) return false;
    if (query.kind === "file" && !noticeHasFile(notice)) return false;
    if (query.kind === "text" && noticeHasFile(notice)) return false;
    if (query.kind === "pinned" && !notice.pinned) return false;
    if (!q) return true;
    return [notice.title, notice.description, notice.category, notice.fileName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
}
