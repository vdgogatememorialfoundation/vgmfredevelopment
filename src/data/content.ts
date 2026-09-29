import type { Announcement, Flyer, Notice, Certificate } from "@/types";

export const announcements: Announcement[] = [
  {
    id: "ann-001",
    title: "National Seminar 2026 Registrations Now Open",
    description:
      "Join us for the flagship National Seminar on Ayurveda Research & Education. Early bird registrations available until 31st August.",
    date: "2026-09-15",
    category: "Events",
    href: "/events/national-seminar-2026",
    priority: "high",
  },
  {
    id: "ann-002",
    title: "New Publication: Ayurveda Clinical Practice Guidelines",
    description:
      "The latest edition of our clinical practice guidelines is now available for purchase. Features updated protocols and case studies.",
    date: "2026-09-10",
    category: "Publications",
    href: "/shop/ayurveda-clinical-practice-guidelines",
    priority: "normal",
  },
  {
    id: "ann-003",
    title: "Fellowship Program Applications Extended",
    description:
      "The deadline for the Vaidya R.B. Gogate Fellowship Program has been extended to 30th September 2026.",
    date: "2026-09-05",
    category: "Education",
    href: "/events/fellowship-program-2026",
    priority: "high",
  },
  {
    id: "ann-004",
    title: "Panchakarma Certification Course — Final Seats",
    description:
      "A limited number of seats remain for the August Panchakarma Certification Course. Registrations close on 30th July.",
    date: "2026-07-20",
    category: "Events",
    href: "/events/panchakarma-certification-course",
    priority: "normal",
  },
  {
    id: "ann-005",
    title: "Women's Health Webinar Series — Free Registration",
    description:
      "Register free for the monthly webinar series on Ayurveda approaches to women's health across the lifecycle.",
    date: "2026-09-01",
    category: "Education",
    href: "/events/ayurveda-womens-health-webinar-series",
    priority: "normal",
  },
];

export const notices: Notice[] = [
  {
    id: "ntc-001",
    title: "National Seminar 2026 — Registration Deadline Extended",
    date: "2026-09-15",
    category: "Events",
    description:
      "The registration deadline for National Seminar 2026 has been extended to 20th September 2026. Limited seats available.",
    attachment: "seminar-2026-brochure.pdf",
    href: "/events/national-seminar-2026",
  },
  {
    id: "ntc-002",
    title: "Vaidya R.B. Gogate Fellowship Program — Results Announced",
    date: "2026-09-10",
    category: "Fellowship",
    description:
      "Congratulations to the selected fellows for the 2026-27 academic year. Individual notifications have been sent via email.",
    attachment: "fellowship-results-2026.pdf",
    href: "/events/fellowship-program-2026",
  },
  {
    id: "ntc-003",
    title: "Certificate Distribution — National Seminar 2025",
    date: "2026-09-05",
    category: "Certificates",
    description:
      "Certificates for National Seminar 2025 participants are now available for download from your account dashboard.",
    href: "/certificate-verification",
  },
  {
    id: "ntc-004",
    title: "New Publication Release: Ayurveda Pharmacology Vol. 2",
    date: "2026-09-01",
    category: "Publications",
    description:
      "The second volume of our Ayurveda Pharmacology series is now available for pre-order. Expected shipping: October 2026.",
    attachment: "pharmacology-vol2-preview.pdf",
    href: "/shop/ayurveda-pharmacology-vol-2",
  },
  {
    id: "ntc-005",
    title: "Clinic Schedule Update — Pune Center",
    date: "2026-08-28",
    category: "Clinics",
    description:
      "Revised consultation timings for Vaidya Gogate Memorial Clinic, Pune effective from 1st October 2026.",
    attachment: "pune-clinic-schedule-oct-2026.pdf",
    href: "/clinics/vaidya-gogate-memorial-clinic-pune",
  },
];

export const flyers: Flyer[] = [
  {
    id: "fly-001",
    title: "National Seminar 2026",
    event: "28-30 September 2026 • Pune",
    date: "2026-09-28",
    image: "/banners/national-seminar-2026.jpg",
    href: "/events/national-seminar-2026",
    cta: "Register Now",
    isDesktop: true,
    isMobile: true,
  },
  {
    id: "fly-002",
    title: "Ayurveda Research Methodology Workshop",
    event: "15-16 October 2026 • Pune",
    date: "2026-10-15",
    image: "/banners/research-workshop-2026.jpg",
    href: "/events/research-methodology-workshop-2026",
    cta: "Learn More",
    isDesktop: true,
    isMobile: true,
  },
  {
    id: "fly-003",
    title: "Fellowship Program 2026-27",
    event: "Applications Open Until 30 Sep",
    date: "2026-09-30",
    image: "/banners/fellowship-2026.jpg",
    href: "/events/fellowship-program-2026",
    cta: "Apply Now",
    isDesktop: true,
    isMobile: false,
  },
];

export const certificates: Certificate[] = [
  {
    certificateNumber: "VGMF-CERT-2026-0001",
    name: "Aarav Sharma",
    event: "National Seminar 2025",
    certificateType: "Participation",
    eventDate: "2025-09-25",
    issueDate: "2026-01-10",
    signature: "Dr. Ananya Deshpande",
  },
  {
    certificateNumber: "VGMF-CERT-2026-0002",
    name: "Priya Nair",
    event: "Panchakarma Certification Course",
    certificateType: "Achievement",
    eventDate: "2025-08-05",
    issueDate: "2025-08-25",
    signature: "Dr. Ananya Deshpande",
  },
  {
    certificateNumber: "VGMF-CERT-2026-0003",
    name: "Rohan Deshmukh",
    event: "Research Methodology Workshop",
    certificateType: "Participation",
    eventDate: "2025-11-10",
    issueDate: "2025-12-01",
    signature: "Dr. Ananya Deshpande",
  },
];

export function getCertificate(certificateNumber: string) {
  const normalized = certificateNumber.trim().toUpperCase();
  return certificates.find(
    (certificate) =>
      certificate.certificateNumber.toUpperCase() === normalized
  );
}