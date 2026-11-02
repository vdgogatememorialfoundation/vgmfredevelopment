import { embedForVideo } from "@/lib/video-embed";
import type { Video } from "@/types";

export default function VideoFrame({
  video,
  className = "h-full w-full",
}: {
  video: Pick<Video, "kind" | "youtubeUrl" | "src" | "poster" | "title">;
  className?: string;
}) {
  const embed = embedForVideo(video);
  if (!embed) return null;
  if (embed.mode === "file") {
    return (
      <video controls preload="metadata" poster={video.poster} className={`${className} object-contain`}>
        {embed.type ? <source src={embed.src} type={embed.type} /> : <source src={embed.src} />}
      </video>
    );
  }
  return (
    <iframe
      src={embed.src}
      title={video.title}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className={className}
    />
  );
}
