"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLiveNotices } from "@/lib/use-cms";
import { deleteNotice, publishNotice } from "@/lib/notices-client";
import { fileToStoredUrl } from "@/lib/images";
import type { Notice } from "@/types";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/schedule";

const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink";

export function NoticeDesk() {
  const records = useLiveNotices();
  const [editing, setEditing] = useState<Notice | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Notice");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pinned, setPinned] = useState(true);
  const [publishAt, setPublishAt] = useState("");
  const [unpublishAt, setUnpublishAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [attachment, setAttachment] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setCategory("Notice");
    setDate(new Date().toISOString().slice(0, 10));
    setPinned(true);
    setPublishAt("");
    setUnpublishAt("");
    setFile(null);
    setAttachment("");
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const load = (notice: Notice) => {
    setEditing(notice);
    setTitle(notice.title);
    setDescription(notice.description);
    setCategory(notice.category);
    setDate(notice.date);
    setPinned(Boolean(notice.pinned));
    setPublishAt(toDatetimeLocal(notice.publishAt));
    setUnpublishAt(toDatetimeLocal(notice.unpublishAt));
    setFile(null);
    setAttachment(notice.attachment ?? "");
    setFileName(notice.fileName ?? "");
  };

  const save = async () => {
    if (!title.trim()) {
      setNote("Add a title. The body and file are optional, but one of them is required.");
      return;
    }
    if (!description.trim() && !file && !attachment) {
      setNote("Add notice text, a file, or both.");
      return;
    }
    setBusy(true);
    try {
      let stored = attachment;
      let storedName = fileName;
      let storedType = editing?.fileType;
      if (file) {
        stored = await fileToStoredUrl(file);
        storedName = file.name;
        storedType = file.type;
      }
      await publishNotice({
        id: editing?.id,
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || "Notice",
        date,
        pinned,
        publishAt: fromDatetimeLocal(publishAt),
        unpublishAt: fromDatetimeLocal(unpublishAt),
        file,
        attachment: stored,
        fileName: storedName,
        fileType: storedType,
      });
      setNote(
        file || attachment
          ? "Published with a file. It appears on the homepage notice board (if pinned), /notices, and the announcement ticker once live."
          : "Published as text. It appears on the homepage notice board (if pinned), /notices, and the announcement ticker once live."
      );
      reset();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not publish the notice.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Notice board</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            Publish text only, or text plus a PDF/image. Admin posts to{" "}
            <code className="rounded bg-paper px-1">POST /api/notices</code> and{" "}
            <code className="rounded bg-paper px-1">PATCH /api/notices/[id]</code>. The public board reads{" "}
            <code className="rounded bg-paper px-1">GET /api/notices</code>. Files download from{" "}
            <code className="rounded bg-paper px-1">GET /api/notices/[id]/file</code>.
          </p>
        </div>
        <Link href="/notices" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-ink">
          View on the site
        </Link>
      </div>

      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-sm font-semibold text-ink">{editing ? "Edit notice" : "New notice"}</p>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
          Title
          <input className={`${field} mt-1`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Deadline or circular title" />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
          Notice text (optional if you attach a file)
          <textarea
            className={`${field} mt-1`}
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="The full notice. Leave empty if only a file should appear."
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
            Category
            <input className={`${field} mt-1`} value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
            Date
            <input className={`${field} mt-1`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
            Pin to homepage board
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
            Go live (leave empty to publish now)
            <input className={`${field} mt-1`} type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
            Hide after (optional)
            <input className={`${field} mt-1`} type="datetime-local" value={unpublishAt} onChange={(event) => setUnpublishAt(event.target.value)} />
          </label>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">File (optional)</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*,.txt"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                if (next) {
                  setFileName(next.name);
                  setAttachment("");
                }
              }}
            />
            {(fileName || attachment) && <span className="text-xs text-stone-600">{file ? file.name : fileName || "File attached"}</span>}
            {(file || attachment) && (
              <button
                type="button"
                className="text-xs font-semibold text-red-700"
                onClick={() => {
                  setFile(null);
                  setAttachment("");
                  setFileName("");
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Remove file
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-400">PDF, Word, image or text, under 2 MB. Text-only notices need no file.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void save()}>
            {busy ? "Publishing…" : editing ? "Update notice" : "Publish notice"}
          </button>
          {editing && (
            <button type="button" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-ink" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
        {note && <p className="text-sm text-ink">{note}</p>}
      </div>

      <ul className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {records.map((notice) => (
          <li key={notice.id} className="flex flex-col gap-2 border-b border-stone-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">{notice.title}</p>
              <p className="text-xs text-stone-500">
                {notice.category} · {notice.date}
                {notice.pinned ? " · Homepage" : ""}
                {notice.publishAt ? ` · Live ${notice.publishAt.slice(0, 16).replace("T", " ")}` : ""}
                {notice.unpublishAt ? ` · Hide ${notice.unpublishAt.slice(0, 16).replace("T", " ")}` : ""}
                {notice.attachment || notice.fileName ? ` · File: ${notice.fileName || "attached"}` : " · Text only"}
              </p>
              {notice.description ? <p className="mt-1 max-w-2xl text-sm text-stone-600">{notice.description}</p> : null}
            </div>
            <div className="flex gap-3 text-sm font-semibold">
              <button type="button" className="text-ink" onClick={() => load(notice)}>
                Edit
              </button>
              <button
                type="button"
                className="text-red-700"
                onClick={() => {
                  if (window.confirm(`Delete “${notice.title}”?`)) void deleteNotice(notice.id);
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
