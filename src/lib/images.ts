/**
 * Small images can still be previewed as data URLs in email drafts.
 * Public site uploads must go through /api/media/upload and persist as /uploads/ URLs.
 */
export async function fileToDataUrl(file: File, maxWidth = 1600, quality = 0.82): Promise<string> {
  if (file.type === "image/svg+xml" || file.type === "image/x-icon") {
    return readAsDataUrl(file);
  }
  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, maxWidth / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0, width, height);
  const keepAlpha = file.type === "image/png" && width <= 600;
  return canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", quality);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file is not an image the browser can open."));
    image.src = src;
  });
}

export async function cropImageToFile(
  source: string,
  crop: { sx: number; sy: number; sw: number; sh: number },
  fileName = "crop.jpg"
) {
  const image = await loadImage(source);
  const sx = Math.max(0, Math.min(image.naturalWidth - 1, Math.round(crop.sx)));
  const sy = Math.max(0, Math.min(image.naturalHeight - 1, Math.round(crop.sy)));
  const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.round(crop.sw)));
  const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.round(crop.sh)));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not crop that image.");
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not crop that image."))), "image/jpeg", 0.9);
  });
  const base = fileName.replace(/\.[^.]+$/, "") || "crop";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export async function fileToStoredUrl(file: File, maxBytes = 25_000_000) {
  if (file.size > maxBytes) {
    throw new Error("Use a file under 25 MB.");
  }
  const { uploadMediaFile } = await import("@/lib/media-client");
  return uploadMediaFile(file);
}

export function isStorageFull(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22);
}

export function isDisplayableImage(value?: string) {
  return Boolean(value && (/^(https?:|data:image|\/)/i.test(value) || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value)));
}
