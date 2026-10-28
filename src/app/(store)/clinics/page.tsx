import type { Metadata } from "next";
import { ClinicsIndex } from "@/components/site/PublicRecords";

export const metadata: Metadata = {
  title: "Clinics",
  description: "Vaidya Gogate Memorial Foundation clinics providing Ayurveda consultation and community care.",
};

export default function ClinicsPage() {
  return <ClinicsIndex />;
}
