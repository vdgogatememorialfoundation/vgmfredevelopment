import type { Video } from "@/types";

export const videos: Video[] = [];

export function getYouTubeId(url: string): string {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : "";
}

export const videoCategories = [
  "All",
  ...Array.from(new Set(videos.map((video) => video.category))),
];
