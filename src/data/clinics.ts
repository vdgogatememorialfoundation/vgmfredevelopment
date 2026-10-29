import type { Clinic } from "@/types";

export const clinics: Clinic[] = [];

export function getClinicBySlug(slug: string) {
  return clinics.find((clinic) => clinic.slug === slug);
}
