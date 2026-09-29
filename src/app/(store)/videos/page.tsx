import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import VideosGrid from "@/components/videos/VideosGrid";
import { getYouTubeId } from "@/data/videos";
import { getVideos } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Videos",
  description:
    "Watch lectures, seminar recordings and documentaries from Vaidya Gogate Memorial Foundation, streamed directly or hosted on our official YouTube channel.",
};

export default async function VideosPage() {
  const videos = await getVideos();
  const featured = videos.find((video) => video.featured);

  return (
    <main>
      <PageHeader
        eyebrow="Media"
        title="Videos"
        description="Lectures, seminar recordings, documentaries and outreach films from the Foundation. Uploads are streamed directly here; the rest play from our official YouTube channel."
      />

      {featured && (
        <section className="border-b border-border bg-warm-cream">
          <div className="container grid items-center gap-8 py-10 lg:grid-cols-2">
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(
                  featured.youtubeUrl ?? ""
                )}`}
                title={featured.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <div>
              <p className="eyebrow">Featured Video</p>
              <h1 className="heading-3 sm:heading-2">{featured.title}</h1>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {featured.description}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {featured.category} · {featured.duration}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="section bg-background">
        <div className="container">
          <VideosGrid videos={videos} />
        </div>
      </section>
    </main>
  );
}