import { getYouTubeId } from "@/data/videos";
import type { Video } from "@/types";
import { formatDate } from "@/lib/utils";

export default function VideoCard({ video }: { video: Video }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        {video.kind === "youtube" && video.youtubeUrl ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(
              video.youtubeUrl
            )}`}
            title={video.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <video
            controls
            preload="metadata"
            poster={video.poster}
            className="h-full w-full object-contain"
          >
            <source src={video.src} type="video/mp4" />
            Your browser does not support playing this video.
          </video>
        )}
        {video.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {video.duration}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {video.category} · {formatDate(video.date)}
        </p>
        <h3 className="mt-1 text-sm font-semibold leading-snug text-text-primary">
          {video.title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          {video.description}
        </p>
      </div>
    </article>
  );
}