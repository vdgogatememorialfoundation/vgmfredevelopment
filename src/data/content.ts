import type { Announcement, Flyer, Notice, Certificate } from "@/types";

export const announcements: Announcement[] = [];
export const notices: Notice[] = [];
export const flyers: Flyer[] = [];
export const certificates: Certificate[] = [];

export function getCertificate(certificateNumber: string) {
  const normalized = certificateNumber.trim().toUpperCase();
  return certificates.find(
    (certificate) => certificate.certificateNumber.toUpperCase() === normalized
  );
}
