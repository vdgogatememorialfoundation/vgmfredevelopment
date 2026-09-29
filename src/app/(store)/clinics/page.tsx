import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import ClinicCard from "@/components/clinics/ClinicCard";
import RequireAuth from "@/components/auth/RequireAuth";
import { getClinics } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Clinics",
  description:
    "Vaidya Gogate Memorial Foundation clinics providing authentic Ayurveda consultation, therapy and community care across Maharashtra.",
};

export default async function ClinicsPage() {
  const clinics = await getClinics();
  return (
    <RequireAuth message="Sign in to view clinic details and book consultations.">
      <main>
        <PageHeader
          eyebrow="Clinics"
          title="Our Clinics"
          description="Foundation clinics providing authentic Ayurveda consultation, Panchakarma therapy, research care and community health programmes."
        />

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
    </RequireAuth>
  );
}