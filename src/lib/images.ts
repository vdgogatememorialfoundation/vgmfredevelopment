/**
 * Browser storage holds roughly 5 MB per site, so uploads are downscaled and
 * re-encoded before they are saved alongside the content that uses them.
 */
export async function fileToDataUrl(file: File, maxWidth = 640, quality = 0.6): Promise<string> {
  if (file.type === "image/svg+xml" || file.type === "image/x-icon") {
    return readAsDataUrl(file);
  }
  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  const maxHeight = Math.round(maxWidth * 0.48);
  const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
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

export async function fileToStoredUrl(file: File, maxBytes = 2_000_000) {
  if (file.size > maxBytes) {
    throw new Error("Use a file under 2 MB, or a public file URL.");
  }
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
    return fileToDataUrl(file);
  }
  return readAsDataUrl(file);
}

export function isStorageFull(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22);
}
