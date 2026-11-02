import type { Clinic, ClinicHours } from "@/types";

const hours: ClinicHours[] = [
  { day: "Monday", from: "18:00", to: "22:00" },
  { day: "Tuesday", from: "18:00", to: "22:00" },
  { day: "Wednesday", from: "18:00", to: "22:00" },
  { day: "Thursday", from: "18:00", to: "22:00" },
  { day: "Friday", closed: true },
  { day: "Saturday", closed: true },
  { day: "Sunday", closed: true },
];

export const clinics: Clinic[] = [
  {
    id: "clinic-nana-peth",
    name: "Vaidya Gogate Memorial Foundation Clinic",
    slug: "nana-peth",
    doctor: "Vaidya Gogate Memorial Foundation",
    specialization: "Ayurveda consultation",
    city: "Pune",
    address:
      "102, Ramprasad Chambers, 368/1, Jawaharlal Nehru Rd, near Kirad Hospital, above Shraddha Medicals, New Nana Peth, Pune, Maharashtra 411002",
    phone: "093737 92952",
    timings: "Monday to Thursday, 6:00 PM – 10:00 PM",
    weeklyHours: hours,
    about: "Foundation clinic at Ramprasad Chambers, New Nana Peth. Hours and the address can be changed from Admin → Clinics.",
    email: "care@vaidyagogate.org",
    mapLink: "https://www.google.com/maps/search/?api=1&query=102+Ramprasad+Chambers+Jawaharlal+Nehru+Rd+Pune+411002",
  },
];

export function getClinicBySlug(slug: string) {
  return clinics.find((clinic) => clinic.slug === slug);
}
