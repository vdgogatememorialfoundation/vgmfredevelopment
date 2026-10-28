import type { Metadata } from "next";
import { clinics } from "@/data/clinics";
import { ClinicDetail } from "@/components/site/PublicRecords";

interface ClinicDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return clinics.map((clinic) => ({ slug: clinic.slug }));
}

export async function generateMetadata({ params }: ClinicDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const clinic = clinics.find((item) => item.slug === slug);
  if (!clinic) return { title: "Clinic" };
  return { title: clinic.name, description: clinic.about };
}

export default async function ClinicDetailPage({ params }: ClinicDetailPageProps) {
  const { slug } = await params;
  return <ClinicDetail slug={slug} />;
}
