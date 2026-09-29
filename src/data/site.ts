export const impactStats = [
  { value: 40, suffix: "+", label: "Years of service", description: "Carrying forward a lifetime of Ayurveda scholarship" },
  { value: 25000, suffix: "+", label: "Patients served", description: "Through Foundation clinics and health camps" },
  { value: 12000, suffix: "+", label: "Professionals trained", description: "Seminars, workshops and certification courses" },
  { value: 60, suffix: "+", label: "Publications", description: "Clinical references, texts and research volumes" },
];

export const programmes = [
  {
    slug: "education",
    icon: "GraduationCap",
    title: "Education & Training",
    description: "Certification courses, fellowships and mentorship programmes for students and practising physicians.",
    points: ["Panchakarma certification", "Fellowship programme", "Continuing medical education"],
    href: "/events",
  },
  {
    slug: "research",
    icon: "FlaskConical",
    title: "Research & Scholarship",
    description: "Structured clinical research, methodology workshops and scholarly review of classical formulations.",
    points: ["Clinical research clinic", "Methodology workshops", "Research grants"],
    href: "/articles",
  },
  {
    slug: "clinical-care",
    icon: "Stethoscope",
    title: "Clinical Care",
    description: "Authentic Ayurveda consultation and therapy across Foundation clinics in Maharashtra.",
    points: ["General consultation", "Panchakarma therapies", "Chronic disease care"],
    href: "/clinics",
  },
  {
    slug: "publications",
    icon: "BookOpen",
    title: "Publications",
    description: "Preserving classical knowledge through clinical guidelines, pharmacology texts and research volumes.",
    points: ["Clinical guidelines", "Pharmacology series", "Legacy writings"],
    href: "/shop",
  },
  {
    slug: "community",
    icon: "HeartHandshake",
    title: "Community Health",
    description: "Free health camps, awareness lectures and preventive care outreach in underserved communities.",
    points: ["Health camps", "Awareness lectures", "Preventive care"],
    href: "/programmes#community",
  },
  {
    slug: "events",
    icon: "Presentation",
    title: "Seminars & Conferences",
    description: "National seminars, webinars and conferences that bring the Ayurveda community together.",
    points: ["National seminar", "Webinar series", "Expert panels"],
    href: "/events",
  },
] as const;

export const legacyTimeline = [
  { year: "1912", title: "Early life", description: "Born into a family with a deep tradition of learning and the classical sciences." },
  { year: "1935", title: "Clinical practice", description: "Began a lifetime of practice rooted in the samhitas and careful observation." },
  { year: "1952", title: "Research", description: "Published research on classical formulations and their scientific basis." },
  { year: "1974", title: "Landmark texts", description: "Authored renowned pharmacology works preserving classical knowledge." },
  { year: "Today", title: "The Foundation", description: "Education, research, clinics and publications carry his work forward." },
];

export const testimonials = [
  {
    quote: "The National Seminar is the most rigorous Ayurveda gathering I attend each year. The balance of classical depth and modern research is unmatched.",
    name: "Dr. Rajesh Iyer",
    role: "Ayurveda Physician, Bengaluru",
  },
  {
    quote: "The Panchakarma certification course transformed my clinical practice. Every session was grounded in the texts and in real patient care.",
    name: "Vaidya Sneha Pawar",
    role: "Course Alumna, Pune",
  },
  {
    quote: "As a researcher, the Foundation's methodology workshops gave me the structure I needed to design my first clinical study.",
    name: "Dr. Kavita Rao",
    role: "PhD Scholar, Mumbai",
  },
  {
    quote: "The clinic's care was thorough and compassionate. The physicians took time to explain diet, routine and therapy in detail.",
    name: "Suresh Kulkarni",
    role: "Patient, Pune Clinic",
  },
];

export const partners = [
  "Savitribai Phule Pune University",
  "Ayurveda Research Trust",
  "Tilak Ayurved Mahavidyalaya",
  "Heritage Herbs",
  "National Ayurveda Council",
  "Bharatiya Vidya Samiti",
  "Maharashtra Health Mission",
  "Ayush Knowledge Network",
];

export const homeFaqs = [
  {
    question: "How do I register for a Foundation event or seminar?",
    answer: "Event details are published on the Events page. Registrations for seminars are handled on the official seminar website — use the “Register” button on any event card to continue.",
  },
  {
    question: "How can I verify a certificate issued by the Foundation?",
    answer: "Visit Certificate Verification and enter the certificate number printed on your certificate (for example VGMF-CERT-2026-0001). The verified details appear instantly.",
  },
  {
    question: "Can I book a consultation at a Foundation clinic?",
    answer: "Yes. Each clinic page lists timings, fees and contact details. Call the clinic directly or send an enquiry through the Contact page.",
  },
  {
    question: "Do you ship publications across India?",
    answer: "We ship across India with tracked delivery. Orders above the free-shipping threshold ship free; store pickup is also available for selected titles.",
  },
  {
    question: "How can I support the Foundation’s work?",
    answer: "You can contribute to scholarships, research, clinics or community camps from the Support Us page. Contributions are eligible for tax benefits as applicable.",
  },
];

export const faqCategories = [
  {
    title: "Events & Registrations",
    items: [
      homeFaqs[0],
      { question: "Are online events recorded?", answer: "Selected sessions are recorded and published in the Videos library after the event." },
      { question: "Can I cancel or transfer my registration?", answer: "Cancellation and transfer policies are listed on each event page. Contact support with your registration ID for assistance." },
    ],
  },
  {
    title: "Certificates",
    items: [
      homeFaqs[1],
      { question: "How long does it take to receive my certificate?", answer: "Certificates are usually issued within 15–30 days of the event and appear in your account dashboard." },
    ],
  },
  {
    title: "Clinics",
    items: [
      homeFaqs[2],
      { question: "Do clinics offer Panchakarma therapy?", answer: "Yes, selected clinics offer classical Panchakarma under the supervision of senior physicians after an initial consultation." },
    ],
  },
  {
    title: "Shop & Orders",
    items: [
      homeFaqs[3],
      { question: "What is the return policy?", answer: "Eligible items can be returned within 7 days of delivery. See the Refund Policy page for full details." },
      { question: "How can I track my order?", answer: "Sign in and open My Orders to see real-time tracking for every shipment." },
    ],
  },
  {
    title: "Support & Donations",
    items: [
      homeFaqs[4],
      { question: "Will I receive a receipt for my contribution?", answer: "Yes. A receipt is emailed for every contribution, with tax-exemption details where applicable." },
    ],
  },
];

export const donationTiers = [
  { amount: 1000, title: "Friend", description: "Supports one patient consultation at a community clinic." },
  { amount: 5000, title: "Supporter", description: "Funds study material for five Ayurveda students." },
  { amount: 25000, title: "Patron", description: "Sponsors a free community health camp in a rural district." },
  { amount: 100000, title: "Benefactor", description: "Endows a research fellowship for a full academic year." },
];

export const donationCauses = [
  { icon: "GraduationCap", title: "Scholarships", description: "Help deserving students pursue Ayurveda education and training." },
  { icon: "FlaskConical", title: "Research", description: "Fund clinical studies and scholarly work on classical formulations." },
  { icon: "HeartHandshake", title: "Community Camps", description: "Bring free consultations and preventive care to underserved areas." },
  { icon: "Library", title: "Library & Archives", description: "Preserve manuscripts, rare texts and the writings of Vaidya Gogate." },
];

export const galleryItems = [
  { id: "g1", title: "National Seminar 2025 — Inaugural session", category: "Seminars", tone: "from-navy to-burgundy", span: "lg:col-span-2 lg:row-span-2" },
  { id: "g2", title: "Panchakarma demonstration", category: "Education", tone: "from-sage to-navy", span: "" },
  { id: "g3", title: "Community health camp, Nashik", category: "Outreach", tone: "from-gold to-[#7a4f1f]", span: "" },
  { id: "g4", title: "Research methodology workshop", category: "Research", tone: "from-burgundy to-sage", span: "lg:row-span-2" },
  { id: "g5", title: "Library & manuscript archive", category: "Heritage", tone: "from-[#3a2410] to-gold", span: "" },
  { id: "g6", title: "Fellowship cohort 2025-26", category: "Education", tone: "from-navy-light to-burgundy-dark", span: "" },
  { id: "g7", title: "Herbal garden walk", category: "Heritage", tone: "from-sage to-[#1d4d38]", span: "lg:col-span-2" },
  { id: "g8", title: "Award ceremony", category: "Seminars", tone: "from-gold to-burgundy", span: "" },
  { id: "g9", title: "Women's health webinar", category: "Outreach", tone: "from-burgundy-dark to-navy", span: "" },
];

export const coreValues = [
  { icon: "ShieldCheck", title: "Integrity", description: "Faithful to the classical texts and to honest scholarship." },
  { icon: "Microscope", title: "Rigour", description: "Evidence-informed practice and structured research." },
  { icon: "HeartHandshake", title: "Compassion", description: "Care for every patient, student and community we serve." },
  { icon: "Sprout", title: "Continuity", description: "Passing living knowledge to the next generation." },
];
