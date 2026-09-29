import type { Clinic } from "@/types";

export const clinics: Clinic[] = [
  {
    id: "cli-001",
    name: "Vaidya Gogate Memorial Clinic, Pune",
    slug: "vaidya-gogate-memorial-clinic-pune",
    doctor: "Vaidya Sunil Khandekar",
    specialization: "Panchakarma & General Ayurveda",
    city: "Pune, Maharashtra",
    address: "12 Sadashiv Peth, Near Omkareshwar Temple, Pune 411030",
    phone: "+91 20 1234 5678",
    timings: "Mon – Sat: 9:00 AM – 1:00 PM, 5:00 PM – 8:00 PM",
    consultationFee: "₹300",
    about:
      "The flagship clinic of the Foundation, offering general Ayurveda consultations, Panchakarma therapies and follow-up care under the supervision of senior physicians.",
    services: ["General Consultation", "Panchakarma", "Diet & Lifestyle Counsel"],
  },
  {
    id: "cli-002",
    name: "VGMF Research Clinic, Pune University Campus",
    slug: "vgmf-research-clinic-pune-university",
    doctor: "Dr. Meera Joshi",
    specialization: "Clinical Research & Chronic Disease",
    city: "Pune, Maharashtra",
    address: "VGMF Research Centre, Pune University Campus, Pune 411007",
    phone: "+91 20 2345 6789",
    timings: "Mon – Fri: 10:00 AM – 4:00 PM",
    consultationFee: "₹400",
    about:
      "A clinic focused on structured clinical research, longitudinal follow-up and the care of patients with chronic conditions.",
    services: ["Research Studies", "Chronic Disease Care", "Health Check-ups"],
  },
  {
    id: "cli-003",
    name: "Ayurvedic Wellness Centre, Mumbai",
    slug: "ayurvedic-wellness-centre-mumbai",
    doctor: "Dr. Shalini Bhagat",
    specialization: "Women's Health & Wellness",
    city: "Mumbai, Maharashtra",
    address: "45 Linking Road, Bandra West, Mumbai 400050",
    phone: "+91 22 3456 7890",
    timings: "Mon – Sat: 9:30 AM – 6:00 PM",
    consultationFee: "₹350",
    about:
      "A wellness-focused centre specialising in women's health across the lifecycle, seasonal regimens and preventive care.",
    services: ["Women's Health", "Seasonal Regimens", "Preventive Care"],
  },
  {
    id: "cli-004",
    name: "Community Health Clinic, Nashik",
    slug: "community-health-clinic-nashik",
    doctor: "Vaidya Group Practice",
    specialization: "Community & Preventive Ayurveda",
    city: "Nashik, Maharashtra",
    address: "7 College Road, Nashik 422005",
    phone: "+91 253 456 7890",
    timings: "Mon – Fri: 9:00 AM – 2:00 PM",
    consultationFee: "₹150",
    about:
      "The Foundation's community clinic delivering accessible preventive and primary Ayurveda care, including free camps and school health programmes.",
    services: ["Community Care", "Health Camps", "School Health"],
  },
];

export function getClinicBySlug(slug: string) {
  return clinics.find((clinic) => clinic.slug === slug);
}