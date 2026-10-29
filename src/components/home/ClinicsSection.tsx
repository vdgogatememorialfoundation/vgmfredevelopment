"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import ClinicCard from "@/components/clinics/ClinicCard";
import { useLiveClinics } from "@/lib/use-cms";

export default function ClinicsSection() {
  const shown = useLiveClinics().slice(0, 3);

  return (
    <section className="section-paper" aria-labelledby="clinics-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Clinics"
          title="Our clinics"
          description="Foundation clinics providing Ayurveda consultation, therapy and community care."
          action={
            <Link href="/clinics" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
              View all
            </Link>
          }
        />

        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">
            No clinics are listed yet.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((clinic) => (
              <ClinicCard key={clinic.id} clinic={clinic} />
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link href="/clinics" className="btn-outline">
            View all clinics
          </Link>
        </div>
      </div>
    </section>
  );
}