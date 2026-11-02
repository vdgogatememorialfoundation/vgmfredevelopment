import VideoFrame from "@/components/videos/VideoFrame";
import type { Video } from "@/types";
import { formatDate } from "@/lib/utils";

export default function VideoCard({ video }: { video: Video }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        <VideoFrame video={video} />
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
      </div>
    </article>
  );
}
