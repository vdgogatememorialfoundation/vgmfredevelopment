"use client";

import { useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/images";
import type { CaptionedImage } from "@/types";

const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export function ImageField({
  label,
  value,
  onChange,
  maxWidth,
  hint,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  maxWidth?: number;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await fileToDataUrl(file, maxWidth));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-slate-400">No image</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            className={input}
            placeholder="Paste an image URL or upload a file"
            value={value?.startsWith("data:") ? "Uploaded image" : value ?? ""}
            readOnly={value?.startsWith("data:")}
            onChange={(event) => onChange(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => fileRef.current?.click()}>
              {busy ? "Uploading…" : "Upload image"}
            </button>
            {value && (
              <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600" onClick={() => onChange("")}>
                Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function GalleryField({
  label,
  images,
  onChange,
  captionLabel = "Caption",
}: {
  label: string;
  images: CaptionedImage[];
  onChange: (images: CaptionedImage[]) => void;
  captionLabel?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      const added: CaptionedImage[] = [];
      for (const file of Array.from(files)) {
        added.push({ src: await fileToDataUrl(file, 1200, 0.8), caption: "" });
      }
      onChange([...images, ...added]);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const update = (index: number, patch: Partial<CaptionedImage>) =>
    onChange(images.map((image, i) => (i === index ? { ...image, ...patch } : image)));

  const move = (index: number, delta: number) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <div className="flex gap-2">
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : "Upload images"}
          </button>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => onChange([...images, { src: "", caption: "" }])}>
            Add by URL
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => add(event.target.files)} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {images.length === 0 && <p className="text-xs text-slate-500">No images yet.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {images.map((image, index) => (
          <li key={index} className="flex gap-3 rounded-lg border border-slate-200 p-2">
            <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-slate-50">
              {image.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.src} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {!image.src.startsWith("data:") && (
                <input className={input} placeholder="Image URL" value={image.src} onChange={(event) => update(index, { src: event.target.value })} />
              )}
              <textarea className={input} rows={2} placeholder={captionLabel} value={image.caption ?? ""} onChange={(event) => update(index, { caption: event.target.value })} />
              <div className="flex gap-3 text-xs font-semibold">
                <button type="button" className="text-slate-500" onClick={() => move(index, -1)}>Up</button>
                <button type="button" className="text-slate-500" onClick={() => move(index, 1)}>Down</button>
                <button type="button" className="text-red-600" onClick={() => onChange(images.filter((_, i) => i !== index))}>Remove</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
