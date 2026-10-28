"use client";

import Link from "next/link";
import Badge from "@/components/common/Badge";
import PageHeader from "@/components/common/PageHeader";
import ClinicCard from "@/components/clinics/ClinicCard";
import VideosGrid from "@/components/videos/VideosGrid";
import { getYouTubeId } from "@/data/videos";
import { useLiveAnnouncements, useLiveClinics, useLiveNotices, useLiveVideos } from "@/lib/use-cms";
import { formatDate } from "@/lib/utils";

export function AnnouncementsIndex() {
  const items = [...useLiveAnnouncements()].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <main>
      <PageHeader eyebrow="Announcements" title="All Announcements" description="News and updates from the Vaidya Gogate Memorial Foundation." />
      <section className="section bg-background">
        <div className="container max-w-4xl space-y-4">
          {items.map((announcement) => (
            <article key={announcement.id} className="card p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="burgundy">{announcement.category}</Badge>
                <time className="text-sm text-text-muted" dateTime={announcement.date}>{formatDate(announcement.date)}</time>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-text-primary">{announcement.title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">{announcement.description}</p>
              <Link href={announcement.href} className="mt-4 inline-block text-sm font-semibold text-burgundy">Read more</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function NoticesIndex() {
  const items = [...useLiveNotices()].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <main>
      <PageHeader eyebrow="Notice Board" title="All Notices" description="Official notices, deadlines and important updates from the Foundation." />
      <section className="section bg-background">
        <div className="container max-w-4xl space-y-4">
          {items.map((notice) => (
            <article key={notice.id} className="card p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="burgundy">{notice.category}</Badge>
                <time className="text-sm text-text-muted" dateTime={notice.date}>{formatDate(notice.date)}</time>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-text-primary">{notice.title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">{notice.description}</p>
              {notice.href && <Link href={notice.href} className="mt-4 inline-block text-sm font-semibold text-burgundy">Open notice</Link>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function VideosIndex() {
  const videos = useLiveVideos();
  const featured = videos.find((video) => video.featured) ?? videos[0];
  return (
    <main>
      <PageHeader eyebrow="Media" title="Videos" description="Lectures, seminar recordings and films published from the admin console." />
      {featured?.youtubeUrl && (
        <section className="border-b border-border bg-warm-cream">
          <div className="container grid items-center gap-8 py-10 lg:grid-cols-2">
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
              <iframe
                title={featured.title}
                src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(featured.youtubeUrl)}`}
                className="h-full w-full"
                allowFullScreen
              />
            </div>
            <div>
              <h2 className="heading-3">{featured.title}</h2>
              <p className="mt-3 text-sm leading-6 text-text-muted">{featured.description}</p>
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

export function ClinicsIndex() {
  const clinics = useLiveClinics();
  return (
    <main>
      <PageHeader eyebrow="Clinics" title="Our Clinics" description="Foundation clinics published from the admin console." />
      <section className="section bg-background">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {clinics.map((clinic) => (
              <ClinicCard key={clinic.id} clinic={clinic} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export function ClinicDetail({ slug }: { slug: string }) {
  const clinic = useLiveClinics().find((item) => item.slug === slug);
  if (!clinic) {
    return (
      <main className="container py-20">
        <h1 className="heading-2">Clinic not published</h1>
        <Link href="/clinics" className="btn-outline mt-6">All clinics</Link>
      </main>
    );
  }
  return (
    <main>
      <section className="border-b border-border bg-warm-cream">
        <div className="container py-10">
          <Link href="/clinics" className="text-sm text-text-muted">Clinics</Link>
          <h1 className="heading-1 mt-4">{clinic.name}</h1>
          <p className="mt-3 text-sm font-semibold text-burgundy">{clinic.city} · {clinic.doctor}</p>
        </div>
      </section>
      <section className="section bg-background">
        <div className="container grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <p className="text-body">{clinic.about}</p>
            {clinic.services && clinic.services.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {clinic.services.map((service) => (
                  <li key={service} className="rounded-full border border-border px-3 py-1 text-sm">{service}</li>
                ))}
              </ul>
            )}
          </div>
          <aside className="rounded-2xl border border-border bg-white p-6 text-sm">
            <p className="font-semibold">{clinic.specialization}</p>
            <p className="mt-3 text-text-muted">{clinic.address}</p>
            <p className="mt-2">{clinic.timings}</p>
            <p className="mt-2">{clinic.phone}</p>
            {clinic.consultationFee && <p className="mt-2 font-semibold">{clinic.consultationFee}</p>}
          </aside>
        </div>
      </section>
    </main>
  );
}
