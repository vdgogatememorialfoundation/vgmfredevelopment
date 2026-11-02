import type { Video } from "@/types";

export type VideoEmbed =
  | { mode: "iframe"; src: string }
  | { mode: "file"; src: string; type?: string };

const YOUTUBE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([\w-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/;
const FILE_EXT = /\.(mp4|webm|ogg|ogv|m4v)(?:$|\?)/i;

function httpUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function fileType(src: string): string | undefined {
  const path = src.split("?")[0].toLowerCase();
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".ogg") || path.endsWith(".ogv")) return "video/ogg";
  if (path.endsWith(".mp4") || path.endsWith(".m4v")) return "video/mp4";
  return undefined;
}

function fromLink(raw: string): VideoEmbed | null {
  const pasted = raw.trim();
  const iframe = pasted.match(/<iframe\b[^>]*\ssrc=["']([^"']+)["']/i);
  const value = iframe?.[1] || pasted;
  const youtube = value.match(YOUTUBE);
  if (youtube) return { mode: "iframe", src: `https://www.youtube-nocookie.com/embed/${youtube[1]}` };
  const vimeo = value.match(VIMEO);
  if (vimeo) return { mode: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  const href = httpUrl(value);
  if (!href) return null;
  if (FILE_EXT.test(href) || href.startsWith("/uploads/")) return { mode: "file", src: href, type: fileType(href) };
  return { mode: "iframe", src: href };
}

/** Play an uploaded file, or embed a YouTube, Vimeo, direct file, or other https link. */
export function embedForVideo(video: Pick<Video, "kind" | "youtubeUrl" | "src">): VideoEmbed | null {
  if (video.kind === "upload") return video.src ? fromLink(video.src) : null;
  if (video.youtubeUrl?.trim()) return fromLink(video.youtubeUrl);
  if (video.src?.trim()) return fromLink(video.src);
  return null;
}
