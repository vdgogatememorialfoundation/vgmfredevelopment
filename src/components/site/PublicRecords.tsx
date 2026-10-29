"use client";

import Link from "next/link";
import Badge from "@/components/common/Badge";
import PageHeader from "@/components/common/PageHeader";
import ClinicCard from "@/components/clinics/ClinicCard";
import VideosGrid from "@/components/videos/VideosGrid";
import { getYouTubeId } from "@/data/videos";
import { useLiveAnnouncements, useLiveClinics, useLiveNotices, useLiveVideos } from "@/lib/use-cms";
import { formatDate } from "@/lib/utils";
import { clinicDirectionsUrl, clinicMapEmbed } from "@/lib/maps";

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
              <h2 className="mt-3 text-base font-semibold text-text-primary">{notice.title}</h2>
              {notice.description ? <p className="mt-2 text-sm leading-6 text-text-muted">{notice.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-3">
                {notice.href && <Link href={notice.href} className="text-xs font-semibold text-burgundy">Open notice</Link>}
                {notice.attachment && (
                  <a href={/^(https?:|\/)/.test(notice.attachment) ? notice.attachment : notice.href} className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                    Download PDF
                  </a>
                )}
              </div>
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
  const photos = clinic.photos ?? [];
  const doctors = clinic.doctors ?? [];
  const embed = clinicMapEmbed(clinic);
  return (
    <main>
      <section className="border-b border-border bg-warm-cream">
        <div className="container py-10">
          <Link href="/clinics" className="text-sm text-text-muted hover:text-burgundy">Clinics</Link>
          <h1 className="heading-1 mt-4">{clinic.name}</h1>
          <p className="mt-3 text-sm font-semibold text-burgundy">
            {clinic.specialization} · {clinic.city}
          </p>
          {clinic.operatedBy && <p className="mt-2 text-sm text-text-muted">Operated by {clinic.operatedBy}</p>}
        </div>
      </section>
      {photos.length > 0 && (
        <section className="bg-background pt-10">
          <div className="container grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {photos.map((photo, index) => (
              <figure key={index} className={index === 0 ? "sm:col-span-2 sm:row-span-2" : ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.src} alt={photo.caption || clinic.name} className={`w-full rounded-xl border border-border object-cover ${index === 0 ? "aspect-[4/3]" : "aspect-[4/3]"}`} />
                {photo.caption && <figcaption className="mt-1.5 text-xs text-text-muted">{photo.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}
      <section className="section bg-background">
        <div className="container grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {clinic.about && <p className="text-body whitespace-pre-line">{clinic.about}</p>}
            {clinic.services && clinic.services.length > 0 && (
              <div>
                <h2 className="heading-3 mb-4">Services</h2>
                <ul className="flex flex-wrap gap-2">
                  {clinic.services.map((service) => (
                    <li key={service} className="rounded-full border border-border bg-white px-3 py-1 text-sm">{service}</li>
                  ))}
                </ul>
              </div>
            )}
            {doctors.length > 0 && (
              <div>
                <h2 className="heading-3 mb-4">Our doctors</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {doctors.map((doctor) => (
                    <article key={doctor.id} className="flex gap-4 rounded-2xl border border-border bg-white p-5">
                      {doctor.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={doctor.photo} alt={doctor.name} className="h-20 w-20 shrink-0 rounded-full border border-border object-cover" />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-burgundy/10 text-lg font-semibold text-burgundy">
                          {doctor.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-text-primary">{doctor.name}</h3>
                        <p className="text-sm text-burgundy">{[doctor.qualification, doctor.specialization].filter(Boolean).join(" · ")}</p>
                        {doctor.experience && <p className="mt-1 text-xs text-text-muted">{doctor.experience} experience</p>}
                        {doctor.timings && <p className="mt-1 text-xs text-text-muted">{doctor.timings}</p>}
                        {doctor.bio && <p className="mt-2 text-sm leading-6 text-text-muted">{doctor.bio}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
            {embed && (
              <div>
                <h2 className="heading-3 mb-4">Location</h2>
                <div className="overflow-hidden rounded-2xl border border-border">
                  <iframe title={`Map of ${clinic.name}`} src={embed} className="h-80 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
              </div>
            )}
          </div>
          <aside className="h-fit space-y-3 rounded-2xl border border-border bg-white p-6 text-sm lg:sticky lg:top-28">
            <p className="font-semibold text-text-primary">Visit the clinic</p>
            <p className="text-text-muted">{clinic.address}</p>
            {clinic.timings && <p><span className="text-text-muted">Timings:</span> {clinic.timings}</p>}
            {clinic.consultationFee && <p><span className="text-text-muted">Consultation:</span> {clinic.consultationFee}</p>}
            {clinic.doctor && doctors.length === 0 && <p><span className="text-text-muted">Doctor:</span> {clinic.doctor}</p>}
            {clinic.phone && <a className="block font-semibold text-burgundy" href={`tel:${clinic.phone.replace(/\s/g, "")}`}>{clinic.phone}</a>}
            {clinic.email && <a className="block text-burgundy" href={`mailto:${clinic.email}`}>{clinic.email}</a>}
            <a className="btn-primary mt-2 w-full" href={clinicDirectionsUrl(clinic)} target="_blank" rel="noopener noreferrer">Get directions</a>
          </aside>
        </div>
      </section>
    </main>
  );
}
