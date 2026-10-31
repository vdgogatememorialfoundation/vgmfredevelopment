"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cropImageToFile } from "@/lib/images";

type Box = { x: number; y: number; w: number; h: number };
type Handle = "move" | "nw" | "ne" | "sw" | "se";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ImageCropper({
  source,
  fileName = "crop.jpg",
  onCancel,
  onApply,
  onUseOriginal,
}: {
  source: string;
  fileName?: string;
  onCancel: () => void;
  onApply: (file: File) => void;
  onUseOriginal: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ handle: Handle; startX: number; startY: number; box: Box } | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [display, setDisplay] = useState({ left: 0, top: 0, w: 0, h: 0 });
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const measure = () => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image || !image.naturalWidth) return;
    const frameBox = frame.getBoundingClientRect();
    const ratio = Math.min(frameBox.width / image.naturalWidth, frameBox.height / image.naturalHeight);
    const w = image.naturalWidth * ratio;
    const h = image.naturalHeight * ratio;
    const left = (frameBox.width - w) / 2;
    const top = (frameBox.height - h) / 2;
    setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    setDisplay({ left, top, w, h });
    setBox((current) => {
      if (current.w > 0 && current.h > 0) {
        return {
          x: clamp(current.x, 0, Math.max(0, w - 24)),
          y: clamp(current.y, 0, Math.max(0, h - 24)),
          w: clamp(current.w, 24, w),
          h: clamp(current.h, 24, h),
        };
      }
      const side = Math.min(w, h) * 0.72;
      return { x: (w - side) / 2, y: (h - side) / 2, w: side, h: side };
    });
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const session = drag.current;
      if (!session) return;
      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      const maxW = display.w;
      const maxH = display.h;
      let next = { ...session.box };
      if (session.handle === "move") {
        next.x = clamp(session.box.x + dx, 0, maxW - session.box.w);
        next.y = clamp(session.box.y + dy, 0, maxH - session.box.h);
      } else {
        const right = session.box.x + session.box.w;
        const bottom = session.box.y + session.box.h;
        if (session.handle.includes("w")) {
          const x = clamp(session.box.x + dx, 0, right - 24);
          next.x = x;
          next.w = right - x;
        }
        if (session.handle.includes("e")) {
          next.w = clamp(session.box.w + dx, 24, maxW - session.box.x);
        }
        if (session.handle.includes("n")) {
          const y = clamp(session.box.y + dy, 0, bottom - 24);
          next.y = y;
          next.h = bottom - y;
        }
        if (session.handle.includes("s")) {
          next.h = clamp(session.box.h + dy, 24, maxH - session.box.y);
        }
      }
      setBox(next);
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", measure);
    };
  }, [display.w, display.h]);

  const start = (handle: Handle, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    drag.current = { handle, startX: event.clientX, startY: event.clientY, box };
  };

  const apply = async () => {
    if (!natural.w || !display.w) return;
    setBusy(true);
    setError("");
    try {
      const scaleX = natural.w / display.w;
      const scaleY = natural.h / display.h;
      const file = await cropImageToFile(
        source,
        {
          sx: Math.round(box.x * scaleX),
          sy: Math.round(box.y * scaleY),
          sw: Math.max(1, Math.round(box.w * scaleX)),
          sh: Math.max(1, Math.round(box.h * scaleY)),
        },
        fileName
      );
      onApply(file);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not crop that image.");
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Crop image">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="font-semibold text-slate-900">Crop image</p>
          <p className="mt-1 text-sm text-slate-500">Drag the box or its corners. Only the selected portion will be saved and shown.</p>
        </div>
        <div ref={frameRef} className="relative mx-5 mt-4 h-[min(58vh,28rem)] overflow-hidden rounded-xl bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={source}
            alt=""
            onLoad={measure}
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
          {display.w > 0 ? (
            <div className="absolute" style={{ left: display.left, top: display.top, width: display.w, height: display.h }}>
              <div className="absolute inset-0 bg-ink/35" />
              <div
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(11,31,58,0.35)]"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                onPointerDown={(event) => start("move", event)}
              >
                {(["nw", "ne", "sw", "se"] as Handle[]).map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    aria-label={`Resize ${handle}`}
                    onPointerDown={(event) => start(handle, event)}
                    className={`absolute h-4 w-4 rounded-sm border-2 border-burgundy bg-white ${
                      handle === "nw"
                        ? "-left-2 -top-2 cursor-nwse-resize"
                        : handle === "ne"
                          ? "-right-2 -top-2 cursor-nesw-resize"
                          : handle === "sw"
                            ? "-bottom-2 -left-2 cursor-nesw-resize"
                            : "-bottom-2 -right-2 cursor-nwse-resize"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {error ? <p className="px-5 pt-3 text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4">
          <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={onUseOriginal} disabled={busy}>
            Use full image
          </button>
          <button type="button" className="rounded-lg bg-burgundy px-3 py-2 text-sm font-semibold text-white" onClick={apply} disabled={busy || !box.w}>
            {busy ? "Saving…" : "Apply crop"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
