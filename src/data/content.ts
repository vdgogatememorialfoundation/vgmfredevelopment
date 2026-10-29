import type { Announcement, Flyer, Notice, Certificate } from "@/types";

export const announcements: Announcement[] = [];
export const notices: Notice[] = [];
export const flyers: Flyer[] = [
  {
    id: "slide-legacy",
    title: "Preserving Ayurveda. Advancing knowledge.",
    event: "Vaidya Gogate Memorial Foundation",
    date: "2026-01-01",
    image: "/slides/legacy.svg",
    href: "/about",
    cta: "Discover our legacy",
    isDesktop: true,
    isMobile: true,
  },
  {
    id: "slide-events",
    title: "Seminars, fellowships and workshops",
    event: "Programmes",
    date: "2026-01-01",
    image: "/slides/events.svg",
    href: "/events",
    cta: "Explore events",
    isDesktop: true,
    isMobile: true,
  },
  {
    id: "slide-shop",
    title: "Books and study materials from VGMF",
    event: "Publications",
    date: "2026-01-01",
    image: "/slides/shop.svg",
    href: "/shop",
    cta: "Visit the shop",
    isDesktop: true,
    isMobile: true,
  },
];
export const certificates: Certificate[] = [];

export function getCertificate(certificateNumber: string) {
  const normalized = certificateNumber.trim().toUpperCase();
  return certificates.find(
    (certificate) => certificate.certificateNumber.toUpperCase() === normalized
  );
}
