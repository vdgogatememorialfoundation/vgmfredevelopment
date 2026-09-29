import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import ClinicCard from "@/components/clinics/ClinicCard";
import { clinics as defaultClinics } from "@/data/clinics";

export default function ClinicsSection({ clinics = defaultClinics }: { clinics?: typeof defaultClinics }) {
  const shown = clinics.slice(0, 3);

  return (
    <section className="section bg-warm-cream" aria-labelledby="clinics-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Clinics"
          title="Our Clinics"
          description="Foundation clinics providing authentic Ayurveda consultation, therapy and community care."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/clinics" className="btn-outline">
            View All Clinics
          </Link>
        </div>
      </div>
    </section>
  );
}