import type { Event } from "@/types";

export const events: Event[] = [
  {
    id: "evt-001",
    name: "National Seminar 2026",
    slug: "national-seminar-2026",
    shortDescription:
      "The flagship national seminar on Ayurveda research and education, bringing together practitioners, educators and researchers from across India.",
    description:
      "The Vaidya Gogate Memorial Foundation's flagship annual seminar brings together Ayurveda practitioners, educators, researchers and students for three days of knowledge-sharing, clinical demonstrations and scholarly dialogue. This year's theme focuses on integrating classical Ayurveda with modern research methodology while remaining rooted in tradition.",
    bannerUrl: "/banners/national-seminar-2026.jpg",
    startDate: "2026-09-28",
    endDate: "2026-09-30",
    venue: "Savitribai Phule Pune University Convention Centre",
    city: "Pune, Maharashtra",
    mode: "Offline",
    eventType: "Seminar",
    registrationStart: "2026-05-01",
    registrationEnd: "2026-09-20",
    fee: 5000,
    currency: "INR",
    capacity: 500,
    registrationStatus: "Open",
    speakers: [
      {
        id: "spk-001",
        name: "Dr. Ananya Deshpande",
        designation: "Director, VGMF",
        topic: "Classical Principles in Modern Ayurveda Practice",
      },
      {
        id: "spk-002",
        name: "Vaidya Rajendra Kulkarni",
        designation: "Senior Ayurveda Scholar",
        topic: "Clinical Research in Panchakarma",
      },
      {
        id: "spk-003",
        name: "Dr. Meera Joshi",
        designation: "Professor, Ayurveda College",
        topic: "Ayurveda Education for the Next Generation",
      },
    ],
    schedule: [
      {
        id: "sch-001",
        time: "09:00 – 10:30",
        title: "Inaugural Session & Keynote",
      },
      {
        id: "sch-002",
        time: "11:00 – 13:00",
        title: "Clinical Research in Panchakarma",
      },
      {
        id: "sch-003",
        time: "14:00 – 16:00",
        title: "Panel: Ayurveda Education for the Next Generation",
      },
      {
        id: "sch-004",
        time: "16:30 – 18:00",
        title: "Poster Session & Networking",
      },
    ],
    faqs: [
      {
        question: "Who can attend the seminar?",
        answer:
          "Ayurveda practitioners, educators, researchers, postgraduate and undergraduate students, and anyone with a serious interest in Ayurveda education and research.",
      },
      {
        question: "Is accommodation provided?",
        answer:
          "Accommodation can be arranged at partner hotels near the venue at special seminar rates. Contact us for details after completing registration.",
      },
      {
        question: "Will certificates be issued?",
        answer:
          "Yes. Participants who attend all sessions will receive a participation certificate that can be verified using the Foundation's certificate verification facility.",
      },
    ],
    sponsors: [
      { id: "spn-001", name: "Ayurveda Research Trust", level: "Platinum" },
      { id: "spn-002", name: "Heritage Herbs Pvt. Ltd.", level: "Gold" },
    ],
    highlights: [
      "Over 30 invited speakers",
      "Clinical demonstration sessions",
      "Poster presentation opportunity",
      "Networking with practitioners nationwide",
    ],
    flyers: [
      "/banners/national-seminar-2026.jpg",
      "/banners/research-workshop-2026.jpg",
      "/banners/fellowship-2026.jpg",
    ],
    terms: [
      "Registration fee is non-refundable once confirmed.",
      "Early-bird pricing applies only until the published early-bird deadline.",
      "Participants must carry a valid government ID at the venue for check-in.",
      "Certificates are issued only to participants who attend all scheduled sessions.",
      "The Foundation reserves the right to adjust the programme schedule.",
      "Accommodation, if booked through the Foundation, follows the partner hotel's cancellation policy.",
      "Personal data collected during registration is used only for event administration per our privacy policy.",
    ],
  },
  {
    id: "evt-002",
    name: "Ayurveda Research Methodology Workshop",
    slug: "research-methodology-workshop-2026",
    shortDescription:
      "A hands-on workshop for postgraduate students and researchers on designing methodologically sound Ayurveda research studies.",
    description:
      "This intensive two-day workshop equips postgraduate students and early-career researchers with the tools to design, conduct and publish methodologically sound Ayurveda research. Sessions cover research design, evidence-based literature review, statistical methods and grant writing, with practical exercises throughout.",
    bannerUrl: "/banners/research-workshop-2026.jpg",
    startDate: "2026-10-15",
    endDate: "2026-10-16",
    venue: "VGMF Research Centre",
    city: "Pune, Maharashtra",
    mode: "Offline",
    eventType: "Workshop",
    registrationStart: "2026-07-01",
    registrationEnd: "2026-10-10",
    fee: 3500,
    currency: "INR",
    capacity: 120,
    registrationStatus: "Open",
    speakers: [
      {
        id: "spk-004",
        name: "Dr. Ananya Deshpande",
        designation: "Director, VGMF",
        topic: "Designing Ayurveda Research Studies",
      },
      {
        id: "spk-005",
        name: "Dr. Nitin Patil",
        designation: "Research Statistician",
        topic: "Statistics for Clinical Studies",
      },
    ],
    schedule: [
      {
        id: "sch-005",
        time: "09:30 – 12:30",
        title: "Research Design & Protocol Writing",
      },
      {
        id: "sch-006",
        time: "13:30 – 16:30",
        title: "Statistics Workshop & Case Studies",
      },
    ],
    faqs: [
      {
        question: "Is this workshop suitable for beginners?",
        answer:
          "Yes. The workshop assumes basic familiarity with Ayurveda but no formal research training is required.",
      },
    ],
    highlights: [
      "Small-group practical sessions",
      "Optional follow-up mentorship",
      "Certificate of participation",
    ],
    flyers: ["/banners/research-workshop-2026.jpg"],
    terms: [
      "Workshop fee includes materials and working lunch on both days.",
      "The workshop is non-refundable within 7 days of the start date.",
      "Assignments submitted during the workshop are required for certification.",
      "Seats are limited to 120 and confirmed on a first-come, first-served basis.",
    ],
  },
  {
    id: "evt-003",
    name: "VGMF Fellowship Program 2026-27",
    slug: "fellowship-program-2026",
    shortDescription:
      "An annual residential fellowship for emerging scholars and practitioners pursuing research, teaching or community practice in Ayurveda.",
    description:
      "The Vaidya R. B. Gogate Fellowship Program offers selected fellows a residential research placement with the Foundation, mentorship from senior scholars, access to the Foundation's library and archival collections, and a stipend for the fellowship year. Fellows work on their own research, teaching or community practice projects while contributing to the Foundation's ongoing programmes.",
    bannerUrl: "/banners/fellowship-2026.jpg",
    startDate: "2026-11-01",
    endDate: "2027-10-31",
    venue: "VGMF Campus",
    city: "Pune, Maharashtra",
    mode: "Offline",
    eventType: "Fellowship",
    registrationStart: "2026-04-01",
    registrationEnd: "2026-09-30",
    fee: 0,
    currency: "INR",
    capacity: 10,
    registrationStatus: "Open",
    faqs: [
      {
        question: "Who is eligible to apply?",
        answer:
          "Graduates and postgraduate students of Ayurveda, researchers and practitioners with a demonstrated commitment to the field.",
      },
      {
        question: "Does the fellowship provide a stipend?",
        answer:
          "Selected fellows receive a monthly stipend and residential accommodation on campus for the fellowship year.",
      },
    ],
    highlights: [
      "Monthly stipend",
      "Residential accommodation",
      "Access to Foundation archives",
      "Senior scholar mentorship",
    ],
    flyers: ["/banners/fellowship-2026.jpg"],
    terms: [
      "Fellows must reside on campus for the duration of the fellowship year.",
      "Fellows are expected to present their research at the annual seminar.",
      "The stipend is disbursed monthly conditional on programme milestones.",
      "Early withdrawal from the fellowship requires one month's notice.",
      "All research outputs acknowledge the Foundation's support.",
    ],
  },
  {
    id: "evt-004",
    name: "Panchakarma Certification Course",
    slug: "panchakarma-certification-course",
    shortDescription:
      "An advanced clinical training programme in Panchakarma procedures for practising Ayurveda physicians.",
    description:
      "An advanced clinical training programme designed for practising Ayurveda physicians who wish to deepen their expertise in Panchakarma procedures. The course combines classroom teaching, supervised clinical practice and demonstration using the Foundation's treatment facilities.",
    bannerUrl: "/banners/panchakarma-course.jpg",
    startDate: "2026-08-05",
    endDate: "2026-08-14",
    venue: "VGMF Panchakarma Centre",
    city: "Pune, Maharashtra",
    mode: "Offline",
    eventType: "Training",
    registrationStart: "2026-06-01",
    registrationEnd: "2026-07-30",
    fee: 15000,
    currency: "INR",
    capacity: 30,
    registrationStatus: "Closing Soon",
    speakers: [
      {
        id: "spk-006",
        name: "Vaidya Sunil Khandekar",
        designation: "Chief Physician, VGMF Panchakarma Centre",
        topic: "Clinical Panchakarma Procedures",
      },
    ],
    schedule: [
      {
        id: "sch-007",
        time: "09:00 – 17:00",
        title: "Daily clinical training at the Panchakarma Centre",
      },
    ],
    faqs: [
      {
        question: "Is this course BAMS eligible?",
        answer:
          "The course is a professional certification programme. Please write to us for details on continuing medical education accreditation.",
      },
    ],
    highlights: [
      "Supervised clinical practice",
      "Small batch of 30 physicians",
      "Certification on successful completion",
    ],
    flyers: ["/banners/panchakarma-course.jpg"],
    terms: [
      "Course fee covers tuition, clinical materials and certification on successful completion.",
      "A 50% refund is available if cancellation is made 15 days before the course start.",
      "Participants must hold a recognised Ayurveda qualification.",
      "Clinical practice is conducted under supervision at the VGMF Panchakarma Centre.",
    ],
  },
  {
    id: "evt-005",
    name: "Ayurveda & Women's Health Webinar Series",
    slug: "ayurveda-womens-health-webinar-series",
    shortDescription:
      "A free public webinar series exploring Ayurveda approaches to women's health across the lifecycle.",
    description:
      "A free public webinar series for practitioners and the general public exploring classical Ayurveda perspectives on women's health — from adolescence through pregnancy and menopause — presented by senior physicians of the Foundation.",
    bannerUrl: "/banners/womens-health-webinar.jpg",
    startDate: "2026-10-20",
    endDate: "2026-11-24",
    mode: "Online",
    eventType: "Webinar",
    registrationStart: "2026-09-01",
    registrationEnd: "2026-11-20",
    fee: 0,
    currency: "INR",
    registrationStatus: "Open",
    speakers: [
      {
        id: "spk-007",
        name: "Dr. Shalini Bhagat",
        designation: "Consultant, VGMF",
        topic: "Ayurveda and the Menstrual Cycle",
      },
    ],
    schedule: [
      {
        id: "sch-008",
        time: "Weekly • Saturday 18:00 IST",
        title: "Six live sessions",
      },
    ],
    faqs: [
      {
        question: "Will sessions be recorded?",
        answer:
          "Yes. Registered participants can access session recordings for 30 days after the series concludes.",
      },
    ],
    highlights: [
      "Free to attend",
      "Live Q&A with physicians",
      "Recordings available",
    ],
    flyers: ["/banners/womens-health-webinar.jpg"],
    terms: [
      "Webinar is free; registration is mandatory to receive the access link.",
      "Recordings are available to registered participants for 30 days.",
      "LIVE sessions follow IST; session timings are listed on the event page.",
    ],
  },
  {
    id: "evt-006",
    name: "Rasashastra Awareness Lecture",
    slug: "rasashastra-awareness-lecture",
    shortDescription:
      "A public lecture on the science of Rasashastra — the classical Ayurveda science of therapeutic minerals and metals.",
    description:
      "An evening public lecture introducing the classical science of Rasashastra: the preparation, processing and therapeutic use of mineral and metal formulations in Ayurveda, presented in an accessible manner for students and the interested public.",
    bannerUrl: "/banners/rasashastra-lecture.jpg",
    startDate: "2026-12-05",
    endDate: "2026-12-05",
    venue: "VGMF Lecture Hall",
    city: "Pune, Maharashtra",
    mode: "Hybrid",
    eventType: "Other Foundation Events",
    registrationStart: "2026-10-01",
    registrationEnd: "2026-12-01",
    fee: 200,
    currency: "INR",
    capacity: 150,
    registrationStatus: "Closed",
    speakers: [
      {
        id: "spk-008",
        name: "Vaidya Prakash Vaidya",
        designation: "Senior Scholar",
        topic: "Rasashastra: Science and Practice",
      },
    ],
    highlights: ["Free entry for students", "Live-streamed"],
    flyers: ["/banners/rasashastra-lecture.jpg"],
    terms: [
      "Entry is free for students with valid ID.",
      "The lecture is live-streamed; seats in the hall are limited.",
      "Registration is required to receive the streaming link.",
    ],
  },
];

export function getEventBySlug(slug: string) {
  return events.find((event) => event.slug === slug);
}

export function getUpcomingEvents() {
  return events.filter((event) => event.registrationStatus === "Open" || event.registrationStatus === "Closing Soon");
}