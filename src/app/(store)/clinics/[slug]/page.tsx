import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/common/Badge";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import ClinicCard from "@/components/clinics/ClinicCard";
import RequireAuth from "@/components/auth/RequireAuth";
import { clinics } from "@/data/clinics";

interface ClinicDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return clinics.map((clinic) => ({ slug: clinic.slug }));
}

export async function generateMetadata({
  params,
}: ClinicDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const clinic = clinics.find((item) => item.slug === slug);

  if (!clinic) return {};

  return {
    title: clinic.name,
    description: `Ayurveda clinic in ${clinic.city} — ${clinic.specialization}.`,
  };
}

export default async function ClinicDetailPage({
  params,
}: ClinicDetailPageProps) {
  const { slug } = await params;
  const clinic = clinics.find((item) => item.slug === slug);

  if (!clinic) {
    notFound();
  }

  const otherClinics = clinics
    .filter((item) => item.slug !== clinic.slug)
    .slice(0, 3);

  return (
    <RequireAuth message="Sign in to view clinic details and book consultations.">
      <main>
      <section className="border-b border-border bg-warm-cream">
        <div className="container py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <li>
                <Link href="/" className="transition hover:text-burgundy">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/clinics" className="transition hover:text-burgundy">
                  Clinics
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <span className="font-medium text-text-primary">
                  {clinic.name}
                </span>
              </li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="burgundy">{clinic.city}</Badge>
          </div>

          <h1 className="heading-1 mt-4">{clinic.name}</h1>

          <p className="mt-3 text-burgundy">
            {clinic.doctor} · {clinic.specialization}
          </p>
        </div>
      </section>

      <section className="section bg-background">
        <div className="container grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MediaPlaceholder
              variant="clinic"
              label={clinic.name}
              aspectClassName="aspect-[16/8] rounded-2xl"
            />

            {clinic.about && (
              <div className="mt-8">
                <h2 className="heading-3 mb-4">About the Clinic</h2>
                <p className="text-body">{clinic.about}</p>
              </div>
            )}

            {clinic.services && clinic.services.length > 0 && (
              <div className="mt-8">
                <h2 className="heading-3 mb-4">Services</h2>
                <ul className="grid gap-3 sm:grid-cols-2" role="list">
                  {clinic.services.map((service) => (
                    <li
                      key={service}
                      className="flex items-start gap-3 rounded-xl border border-border bg-white p-4"
                    >
                      <span className="mt-0.5 text-burgundy">✓</span>
                      <span className="text-sm text-text-primary">
                        {service}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Contact & Timings
              </h2>

              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-text-muted">Address</dt>
                  <dd className="mt-1 font-medium text-text-primary">
                    {clinic.address}
                  </dd>
                </div>

                <div>
                  <dt className="text-text-muted">Phone</dt>
                  <dd className="mt-1 font-medium text-text-primary">
                    <a
                      href={`tel:${clinic.phone.replace(/\s/g, "")}`}
                      className="transition hover:text-burgundy"
                    >
                      {clinic.phone}
                    </a>
                  </dd>
                </div>

                <div>
                  <dt className="text-text-muted">Timings</dt>
                  <dd className="mt-1 font-medium text-text-primary">
                    {clinic.timings}
                  </dd>
                </div>

                {clinic.consultationFee && (
                  <div>
                    <dt className="text-text-muted">Consultation</dt>
                    <dd className="mt-1 font-semibold text-burgundy">
                      {clinic.consultationFee}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-6 flex gap-3">
                <a href="#appointment" className="btn-primary flex-1">
                  Book Appointment
                </a>
                <a
                  href="#map"
                  className="btn-outline flex-1"
                  aria-label="View clinic map"
                >
                  Map
                </a>
              </div>
            </div>

            <div
              id="appointment"
              className="rounded-2xl border border-border bg-white p-6 shadow-sm"
            >
              <h2 className="heading-4 text-lg font-semibold text-text-primary">
                Request an Appointment
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                An appointment request will be sent to the clinic. The
                clinic team will confirm availability.
              </p>

              <form className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="apt-name">
                    Your Name
                  </label>
                  <input id="apt-name" type="text" className="input-field" placeholder="Enter your name" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="apt-phone">
                    Phone Number
                  </label>
                  <input id="apt-phone" type="tel" className="input-field" placeholder="+91 98765 43210" />
                </div>
                <button type="submit" className="btn-primary w-full">
                  Request Appointment
                </button>
              </form>
            </div>
          </aside>
        </div>
      </section>

      {otherClinics.length > 0 && (
        <section className="section bg-warm-cream">
          <div className="container">
            <h2 className="heading-3 mb-8">Other Clinics</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {otherClinics.map((item) => (
                <ClinicCard key={item.id} clinic={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
    </RequireAuth>
  );
}