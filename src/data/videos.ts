import type { Video } from "@/types";

export const videos: Video[] = [
  {
    id: "vid-001",
    title: "Preserving Ayurveda — The Vaidya Gogate Legacy",
    description:
      "An introduction to the Foundation, our mission and the enduring legacy of Vaidya R. B. Gogate.",
    date: "2026-08-15",
    category: "Foundation",
    kind: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    poster: "/videos/legacy-poster.jpg",
    duration: "4:32",
    featured: true,
  },
  {
    id: "vid-002",
    title: "National Seminar 2025 — Keynote Address",
    description:
      "Highlights from the opening keynote of the National Ayurveda Seminar 2025.",
    date: "2026-07-20",
    category: "Seminars",
    kind: "youtube",
    youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
    poster: "/videos/seminar-keynote-poster.jpg",
    duration: "18:05",
  },
  {
    id: "vid-003",
    title: "Panchakarma — Principles and Practice",
    description:
      "A clinical walkthrough of classical Panchakarma principles by our faculty.",
    date: "2026-06-12",
    category: "Education",
    kind: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    poster: "/videos/panchakarma-poster.jpg",
    duration: "12:47",
  },
  {
    id: "vid-004",
    title: "Foundation Lecture — Rasa Shastra Essentials",
    description:
      "Recording of our monthly lecture series on Ayurvedic pharmaceutics.",
    date: "2026-05-30",
    category: "Lectures",
    kind: "upload",
    src: "/videos/rasa-shastra-lecture.mp4",
    poster: "/videos/rasa-lecture-poster.jpg",
    duration: "26:10",
  },
  {
    id: "vid-005",
    title: "Community Health Camp — Nashik",
    description:
      "A short film documenting our outreach health camp in Nashik.",
    date: "2026-04-18",
    category: "Outreach",
    kind: "upload",
    src: "/videos/community-camp-nashik.mp4",
    poster: "/videos/camp-nashik-poster.jpg",
    duration: "6:55",
  },
  {
    id: "vid-006",
    title: "40 Years of Vaidya R. B. Gogate — Documentary",
    description:
      "A documentary celebrating four decades of practice and teaching.",
    date: "2026-02-10",
    category: "Foundation",
    kind: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    poster: "/videos/quarante-poster.jpg",
    duration: "21:18",
  },
];

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