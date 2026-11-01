"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/admin/AdminUI";

type Detector = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> };

export function BarcodeCamera({
  onScan,
  onClose,
  label = "Point the camera at a product barcode",
}: {
  onScan: (code: string) => void;
  onClose: () => void;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer = 0;
    let stopped = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
        const detector = Detector
          ? new Detector({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"] })
          : null;
        if (!detector) {
          setError("This browser cannot read barcodes from the live camera. Type the code or use a USB scanner.");
          return;
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes.map((item) => item.rawValue).find((item) => item && item.trim());
            if (value) {
              onScanRef.current(value.trim());
              return;
            }
          } catch {
            /* keep scanning */
          }
          timer = window.setTimeout(() => void tick(), 220);
        };
        void tick();
      } catch {
        setError("Camera access was blocked. Allow the camera, or type the barcode.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">{label}</p>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <video ref={videoRef} className="aspect-video w-full bg-ink object-cover" muted playsInline />
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
            autoFocus
          />
          <Button type="submit">Use code</Button>
        </form>
      </div>
    </div>
  );
}
