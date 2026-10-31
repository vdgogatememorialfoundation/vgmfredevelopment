import { mediaUrl, str, type Row } from "./api";

export const SITE = {
  name: "Vaidya Gogate Memorial Foundation",
  shortName: "VGMF",
  tagline: "Preserving Ayurveda. Advancing Knowledge. Serving Society.",
  purpose:
    "A sanctuary for clinical authenticity, archival texts and philanthropic healing. This platform shares Vd. Ramchandra Ballal Gogate’s work and carries forward his vision — knowledge for all.",
  email: "info@vaidyagogate.org",
  phone: "+91 20 1234 5678",
  address: "Vaidya Gogate Memorial Foundation, Pune, Maharashtra, India",
  nativeName: "वैद्य गोगटे स्मृती प्रतिष्ठान",
  liveLabel: "Foundation live",
  greeting: "नमस्ते",
  shopUrl: "/shop",
  checkoutUrl: "/checkout",
  eventsUrl: "/events",
};

export const STORE = {
  currency: "INR",
  shippingFee: 49,
  freeShippingThreshold: 499,
  gstRate: "5%",
  returnDays: 7,
  courier: "Shiprocket",
  publisher: "Vaidya Gogate Memorial Foundation Publications",
};

export const PORTALS = [
  {
    id: "seminar",
    title: "VGMF Seminar Portal",
    body: "Accredited seminars and workshops for physicians and students.",
    href: "https://seminar.vaidyagogate.org",
  },
  {
    id: "autism",
    title: "Ayurvedic Autism & Neuro Center",
    body: "Clinical protocols, family support and research programmes.",
    href: "https://autism.vaidyagogate.org",
  },
  {
    id: "fellowship",
    title: "Postgraduate Clinical Fellowship",
    body: "Postgraduate clinical fellowship of the Foundation.",
    href: "https://fellowship.vaidyagogate.org",
  },
];

export const EXPLORE = [
  { id: "about", href: "/about", label: "About", icon: "people-outline" as const },
  { id: "events", href: "/events", label: "Events", icon: "calendar-outline" as const },
  { id: "shop", href: "/shop", label: "Shop", icon: "bag-handle-outline" as const },
  { id: "clinics", href: "/clinics", label: "Clinics", icon: "medical-outline" as const },
  { id: "articles", href: "/articles", label: "Articles", icon: "newspaper-outline" as const },
  { id: "gallery", href: "/gallery", label: "Gallery", icon: "images-outline" as const },
  { id: "videos", href: "/videos", label: "Videos", icon: "play-circle-outline" as const },
  { id: "certificates", href: "/certificates", label: "Certificates", icon: "ribbon-outline" as const },
];

export const ABOUT_DEFAULT = {
  title: "About Vaidya Gogate Memorial Foundation",
  intro:
    "Vaidya Gogate Memorial Foundation is a website with a sole motto: Propagation of knowledge. This is a platform to share our grandfather’s, Vd. Ramchandra Ballal Gogate’s work and carry forward his vision ‘knowledge for all’. We are creating this platform as an authentic source of information. Our purpose is to ignite young minds through his writings and teachings.",
  rb: {
    title: "The Legacy of Vaidya R. B. Gogate",
    role: "Ayurvedic pioneer · 1933–2015",
    portrait: "/about/rb-square.jpg",
    excerpt:
      "Vd. R. B. Gogate was born on 4th February, 1933 at Atkar gaon and passed away on 28th September, 2015 at Pune. He received his GFAM and AVP in Shalya-Shalakya from Pune. His OPD was functional till his last days.",
    biography: `Vd. R. B. Gogate was born on 4th February, 1933 at Atkar gaon and passed away on 28th September, 2015 at Pune. He received his GFAM — General Fellow of Ayurvedic Medicine (BOM) — and AVP — Ayur Vidya Parangat in Shalya-Shalakya — from Pune, the degrees for Ayurved graduation and post-graduation at that time. His OPD was functional till his last days.

He worked as a professor for post-graduate studies (Pune University), Director — Research and publication (Sane Guruji Arogya Kendra, Hadapsar), Principal (Tilak Ayurved Mahavidyalaya), Hon. Surgeon and HOD (Seth Tarachand Ramnath Hospital, Pune), C.M.O. (Matru Mandir Hospital, Devrukh), C.M.O. (Seth Tarachand Ramnath Hospital, Pune), Staff casualty officer (Civil Defence, Pune), Chief of AIDS research centre (STRC Hospital, Pune) and Chief of Cancer project (Pethe Arogya Kendra, Belgaum).

He had done extensive research on AIDS, cancer, Agnikarma, Viddhakarma, dhoopan chikitsa in vrana, cauterisation of corns by Ayurvedic method, and raktamokshan. He published books on AIDS, Viddha and Agnikarma, Bhagna and Asthi roga, Shalya tantra and Hasti ayurved.

His work has been recognised and awarded by many institutions. The Pandit Ramnarayan Sharma Award for research in Ayurved (Baidyanath) was received by his son Ar. Padmanabha Gogate at the hands of the honourable President of India Shri Ramnath Kovind.`,
    biographyMr: `आदरणीय व वंदनीय माणसे दुर्मिळ होत असताना वैद्य रामचंद्र बल्लाळ गोगटे यांचे नाव दुर्मिळ व्यक्ती म्हणून अग्रक्रमाने व प्राधान्याने घ्यावे लागेल.`,
  },
  anagha: {
    title: "Dr. Anagha Gogate",
    role: "Trustee · senior scholar · 1936–2019",
    portrait: "/about/anagha-square.jpg",
    excerpt:
      "The most significant contribution in terms of unwavering support and strength to Dr. Ramchandra B. Gogate was made by his wife, Dr. Anagha Ramchandra Gogate. She was born on 7th November 1936 in Panchgani.",
    biography: `The most significant contribution in terms of unwavering support and strength to Dr. Ramchandra B. Gogate was made by his wife, Dr. Anagha Ramchandra Gogate.

She was born on 7th November 1936 to Mr. Gajanan and Indira Sahasrabuddhe in Panchgani, Satara district of Maharashtra. She did her schooling from Sanjeevan Vidyalaya, Panchgani, and moved to Pune in 1950 for her higher secondary studies in Fergusson College. She was later admitted to Tilak Ayurved Mahavidyalaya for BAMS.

She married Dr. Ramchandra Ballal Gogate on 21st May 1963. She received enormous appreciation in teaching as a professor in Tilak Ayurved Mahavidyalaya from 1970 onwards. We lost her on 12th September 2019 after her long-standing battle with prolonged illness.`,
  },
  history: [
    { year: "Lineage", title: "Vd. Mahadev (Bapu) Gogate", body: "Rajavaidya to the king of Jawhar." },
    { year: "Next generation", title: "Vd. Vishnu Mahadev Gogate and Vd. Trimbak Mahadev Gogate", body: "Dravyaguna and Panchakarma." },
    { year: "1933 – 2015", title: "Vd. Ramchandra Ballal Gogate", body: "Physician, teacher and researcher. GFAM and AVP in Shalya-Shalakya. Passed away on 28th September 2015 at Pune." },
    { year: "1936 – 2019", title: "Dr. Anagha Ramchandra Gogate", body: "Born 7th November 1936 in Panchgani. Professor at Tilak Ayurved Mahavidyalaya from 1970." },
    { year: "This platform", title: "Grandchildren of the Gogate family", body: "Creating this platform on behalf of the family to promote grandfather’s lifetime work." },
  ],
  books: ["AIDS", "Viddha and Agnikarma", "Bhagna and Asthi roga", "Shalya tantra", "Hasti ayurved"],
  research: ["AIDS", "Cancer", "Agnikarma", "Viddhakarma", "Dhoopan chikitsa in vrana", "Raktamokshan"],
  awards: [
    { title: "Pandit Ramnarayan Sharma Award", body: "Received by Ar. Padmanabha Gogate at the hands of the President of India Shri Ramnath Kovind." },
    { title: "Sushrut Puraskar", body: "Khadiwale Vaidya Sanstha." },
    { title: "Gayatri Pratishthan Puraskar", body: "For work on AIDS." },
    { title: "Legend Shalaki Karyabhushan Puraskar", body: "In recognition of his work in Shalakya." },
    { title: "Jivan Gaurav Puraskar", body: "TAMV, RSM." },
  ],
  trustees:
    "We, his grandchildren on behalf of the Gogate family are creating this platform to promote our grandfather’s lifetime work and for our strong passion towards the field of Ayurved.",
};

function asRow(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function usable(value: unknown) {
  const src = str(value);
  if (!src || /^data:/i.test(src) || /^blob:/i.test(src)) return "";
  return src;
}

export function resolvedAbout(about: Row | null | undefined) {
  const raw = asRow(about);
  const legacy = asRow(raw.legacy);
  const anagha = asRow(raw.anagha);
  const history = asRow(raw.history);
  const awards = asRow(raw.awards);
  const scholarship = asRow(raw.scholarship);
  const trustees = asRow(raw.trustees);
  const timeline = Array.isArray(history.timeline) ? (history.timeline as Row[]) : [];
  const awardItems = Array.isArray(awards.items) ? (awards.items as Row[]) : [];
  return {
    title: str(raw.title, ABOUT_DEFAULT.title),
    intro: str(raw.intro, ABOUT_DEFAULT.intro),
    rb: {
      title: str(legacy.title, ABOUT_DEFAULT.rb.title),
      role: ABOUT_DEFAULT.rb.role,
      portrait: mediaUrl(usable(legacy.portrait) || ABOUT_DEFAULT.rb.portrait),
      excerpt: str(legacy.biography, ABOUT_DEFAULT.rb.excerpt).split(/\n\s*\n/)[0],
      biography: str(legacy.biography, ABOUT_DEFAULT.rb.biography),
      biographyMr: str(legacy.biographyMr, ABOUT_DEFAULT.rb.biographyMr),
    },
    anagha: {
      title: str(anagha.title, ABOUT_DEFAULT.anagha.title),
      role: ABOUT_DEFAULT.anagha.role,
      portrait: mediaUrl(usable(anagha.portrait) || ABOUT_DEFAULT.anagha.portrait),
      excerpt: str(anagha.biography, ABOUT_DEFAULT.anagha.excerpt).split(/\n\s*\n/)[0],
      biography: str(anagha.biography, ABOUT_DEFAULT.anagha.biography),
    },
    history:
      timeline.length > 0
        ? timeline.map((item) => ({ year: str(item.year), title: str(item.title), body: str(item.description) }))
        : ABOUT_DEFAULT.history,
    books: Array.isArray(scholarship.books) && scholarship.books.length ? (scholarship.books as string[]) : ABOUT_DEFAULT.books,
    research: Array.isArray(scholarship.research) && scholarship.research.length ? (scholarship.research as string[]) : ABOUT_DEFAULT.research,
    awards:
      awardItems.length > 0
        ? awardItems.map((item) => ({ title: str(item.title), body: str(item.body) }))
        : ABOUT_DEFAULT.awards,
    trustees: str(trustees.intro, ABOUT_DEFAULT.trustees),
  };
}
