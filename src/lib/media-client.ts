export async function uploadMediaFile(file: File) {
  const body = new FormData();
  body.set("file", file, file.name);
  const response = await fetch("/api/media/upload", { method: "POST", body, credentials: "same-origin" });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!response.ok || !data.ok || !data.url) {
    throw new Error(data.error || "Could not upload the file.");
  }
  return data.url;
}
