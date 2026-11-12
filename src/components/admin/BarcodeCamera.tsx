"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/admin/AdminUI";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };

/** Camera barcode reading for browsers without the built-in BarcodeDetector (iPhone, Firefox, desktop). */
async function zxingDetector(): Promise<Detector> {
  const zx = await import("@zxing/library");
  const hints = new Map();
  hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [
    zx.BarcodeFormat.EAN_13,
    zx.BarcodeFormat.EAN_8,
    zx.BarcodeFormat.CODE_128,
    zx.BarcodeFormat.CODE_39,
    zx.BarcodeFormat.UPC_A,
    zx.BarcodeFormat.UPC_E,
    zx.BarcodeFormat.QR_CODE,
  ]);
  hints.set(zx.DecodeHintType.TRY_HARDER, true);
  const reader = new zx.MultiFormatReader();
  reader.setHints(hints);
  const canvas = document.createElement("canvas");
  let frame = 0;
  const decode = (source: HTMLCanvasElement) => {
    try {
      const bitmap = new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.HTMLCanvasElementLuminanceSource(source)));
      return reader.decodeWithState(bitmap).getText();
    } catch {
      return "";
    } finally {
      reader.reset();
    }
  };
  return {
    detect: async (video) => {
      if (!video.videoWidth || video.readyState < 2) return [];
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return [];
      // Phones: alternate the whole frame with a zoomed centre crop (small or distant labels), and turn every third crop sideways for upright barcodes.
      frame += 1;
      const crop = frame % 2 === 0;
      const sw = crop ? video.videoWidth * 0.6 : video.videoWidth;
      const sh = crop ? video.videoHeight * 0.6 : video.videoHeight;
      const sx = (video.videoWidth - sw) / 2;
      const sy = (video.videoHeight - sh) / 2;
      const scale = Math.min(1, 1280 / Math.max(sw, sh));
      const rotate = crop && frame % 3 === 0;
      const w = Math.round(sw * scale);
      const h = Math.round(sh * scale);
      canvas.width = rotate ? h : w;
      canvas.height = rotate ? w : h;
      context.save();
      if (rotate) {
        context.translate(h, 0);
        context.rotate(Math.PI / 2);
      }
      context.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      context.restore();
      const text = decode(canvas);
      return text ? [{ rawValue: text }] : [];
    },
  };
}

const FORMATS = ["ean_13", "ean_8", "code_128", "code_39", "code_93", "codabar", "itf", "upc_a", "upc_e", "qr_code", "data_matrix"];

type DetectorClass = { new (opts: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

async function nativeDetector(): Promise<Detector | null> {
  const Native = (window as Window & { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (!Native) return null;
  try {
    const supported = (await Native.getSupportedFormats?.()) ?? FORMATS;
    const formats = FORMATS.filter((item) => supported.includes(item));
    return formats.length ? new Native({ formats }) : null;
  } catch {
    return null;
  }
}

export function BarcodeCamera({
  onScan,
  onClose,
  label = "Point the camera at a product barcode",
  continuous = false,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
  label?: string;
  /** Keep the camera open and read the next code after each scan. */
  continuous?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [last, setLast] = useState("");
  const continuousRef = useRef(continuous);
  useEffect(() => {
    onScanRef.current = onScan;
    continuousRef.current = continuous;
  }, [onScan, continuous]);
  const [finePointer] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer = 0;
    let stopped = false;

    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("The camera needs the https:// site. Type or wedge-scan the code below.");
        return;
      }
      try {
        stream = await navigator.mediaDevices
          .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const [track] = stream.getVideoTracks();
        const caps = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[] };
        if (caps.focusMode?.includes("continuous")) {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => undefined);
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => undefined);
        if (video.readyState < 2) await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
        const native = await nativeDetector();
        const fallback = await zxingDetector();
        let misses = 0;
        let lastValue = "";
        let lastAt = 0;
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            // Native reader first (Android Chrome); every few frames, and always without it (iPhone), ZXing reads too.
            const useNative = native && misses % 3 !== 2;
            const codes = await (useNative ? native : fallback).detect(videoRef.current);
            const value = codes.map((item) => item.rawValue).find((item) => item && item.trim())?.trim();
            if (value && (value !== lastValue || Date.now() - lastAt > 2500)) {
              lastValue = value;
              lastAt = Date.now();
              misses = 0;
              navigator.vibrate?.(80);
              setLast(value);
              onScanRef.current(value);
              if (!continuousRef.current) return;
            } else {
              misses += 1;
            }
          } catch {
            misses += 1;
          }
          timer = window.setTimeout(() => void tick(), 160);
        };
        void tick();
      } catch {
        setError("Camera access was blocked. Allow the camera for this site in the browser settings, or type the barcode.");
      }
    };

    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-2 sm:p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">{label}</p>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="relative">
          <video ref={videoRef} className="aspect-[4/3] max-h-[60vh] w-full bg-ink object-cover sm:aspect-video" muted playsInline autoPlay />
          <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-1/3 -translate-y-1/2 rounded-lg border-2 border-white/80" />
        </div>
        {last ? <p className="px-4 pt-3 text-xs text-emerald-700">Read: {last}</p> : null}
        {error && <p className="px-4 pt-3 text-xs text-red-700">{error}</p>}
        <form
          className="flex gap-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!manual.trim()) return;
            onScan(manual.trim());
          }}
        >
          <input
            className="input-field flex-1"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Or type / wedge-scan the barcode"
            autoFocus={finePointer}
          />
          <Button type="submit">Use code</Button>
        </form>
      </div>
    </div>
  );
}
