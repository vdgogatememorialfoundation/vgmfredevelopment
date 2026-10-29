import { hideNotice, saveNotice } from "@/lib/cms";
import type { PublicNotice } from "@/lib/notice-display";
import type { Notice } from "@/types";

export type { PublicNotice };

export async function fetchNotices(query?: { q?: string; category?: string; kind?: string; year?: string }) {
  const params = new URLSearchParams();
  if (query?.q) params.set("q", query.q);
  if (query?.category) params.set("category", query.category);
  if (query?.kind) params.set("kind", query.kind);
  if (query?.year) params.set("year", query.year);
  const suffix = params.size ? `?${params}` : "";
  const response = await fetch(`/api/notices${suffix}`, { cache: "no-store" });
  const data = (await response.json()) as { ok: boolean; notices?: PublicNotice[]; error?: string };
  if (!response.ok || !data.ok) throw new Error(data.error || "Could not load notices.");
  return data.notices ?? [];
}

function toForm(input: {
  id?: string;
  title: string;
  description: string;
  category: string;
  date: string;
  pinned?: boolean;
  file?: File | null;
  attachment?: string;
  publishAt?: string;
  unpublishAt?: string;
}) {
  const form = new FormData();
  if (input.id) form.set("id", input.id);
  form.set("title", input.title);
  form.set("description", input.description);
  form.set("category", input.category);
  form.set("date", input.date);
  form.set("pinned", input.pinned ? "true" : "false");
  form.set("publishAt", input.publishAt ?? "");
  form.set("unpublishAt", input.unpublishAt ?? "");
  if (input.file) form.set("file", input.file);
  if (!input.file && input.attachment === "") form.set("clearFile", "true");
  return form;
}

function persistLocal(notice: PublicNotice, extra?: { attachment?: string; publishAt?: string; unpublishAt?: string }): Notice {
  const local: Notice = {
    id: notice.id,
    title: notice.title,
    date: notice.date,
    category: notice.category,
    description: notice.description,
    attachment: extra?.attachment || (notice.hasFile ? notice.fileUrl : undefined),
    fileName: notice.fileName,
    fileType: notice.fileType,
    pinned: notice.pinned,
    href: notice.href || `/notices#${notice.id}`,
    publishAt: extra?.publishAt ?? notice.publishAt,
    unpublishAt: extra?.unpublishAt ?? notice.unpublishAt,
  };
  saveNotice(local);
  return local;
}

export async function publishNotice(input: {
  id?: string;
  title: string;
  description: string;
  category: string;
  date: string;
  pinned?: boolean;
  file?: File | null;
  attachment?: string;
  fileName?: string;
  fileType?: string;
  publishAt?: string;
  unpublishAt?: string;
}) {
  const path = input.id ? `/api/notices/${input.id}` : "/api/notices";
  const method = input.id ? "PATCH" : "POST";
  const response = await fetch(path, { method, body: toForm(input) });
  const data = (await response.json()) as { ok: boolean; notice?: PublicNotice; error?: string };
  if (!response.ok || !data.ok || !data.notice) throw new Error(data.error || "Could not publish the notice.");
  persistLocal(data.notice, {
    attachment: input.attachment,
    publishAt: input.publishAt ?? data.notice.publishAt,
    unpublishAt: input.unpublishAt ?? data.notice.unpublishAt,
  });
  return data.notice;
}

export async function deleteNotice(id: string) {
  await fetch(`/api/notices/${id}`, { method: "DELETE" }).catch(() => undefined);
  hideNotice(id);
}
