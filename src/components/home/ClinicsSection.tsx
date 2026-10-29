"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import ClinicCard from "@/components/clinics/ClinicCard";
import { useLiveClinics } from "@/lib/use-cms";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function ClinicsSection() {
  const shown = useLiveClinics().slice(0, 3);
  const { t } = useI18n();

  return (
    <section className="section-paper" aria-labelledby="clinics-heading">
      <div className="container">
        <SectionHeading
          eyebrow={t("home.clinicsEyebrow")}
          title={t("home.clinicsTitle")}
          description={t("home.clinicsDesc")}
          action={
            <Link href="/clinics" className="text-sm font-semibold text-burgundy hover:text-burgundy-dark">
              {t("common.viewAll")}
            </Link>
          }
        />

        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">
            {t("home.noClinics")}
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
            {t("home.viewClinics")}
          </Link>
        </div>
      </div>
    </section>
  );
}