"use client";

import { useState } from "react";
import VideoCard from "@/components/videos/VideoCard";
import { videoCategories } from "@/data/videos";
import type { Video } from "@/types";

export default function VideosGrid({ videos }: { videos: Video[] }) {
  const [active, setActive] = useState("All");
  const filtered =
    active === "All"
      ? videos
      : videos.filter((video) => video.category === active);

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2">
        {videoCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActive(category)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              active === category
                ? "border-burgundy bg-burgundy text-white"
                : "border-border bg-white text-text-muted hover:border-burgundy hover:text-burgundy"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white p-12 text-center text-sm text-text-muted">
          No videos in this category yet.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}