import type { Article } from "@/types";

export const articles: Article[] = [
  {
    id: "art-001",
    title: "Preserving Classical Ayurveda in the Modern Age",
    slug: "preserving-classical-ayurveda-modern-age",
    excerpt:
      "How the teachings of Vaidya R. B. Gogate continue to guide authentic Ayurveda practice and education today.",
    content:
      "Ayurveda is one of the world's most ancient living medical systems, yet its survival depends on faithful transmission. Vaidya R. B. Gogate devoted his life to recording, teaching and refining classical Ayurveda knowledge so that it could be passed to future generations with integrity.\n\nFrom his earliest years, Vaidya Gogate insisted that the classical texts must remain the foundation of practice. He emphasised that genuine scholarship requires close reading of the samhitas alongside careful observation of patients and remedies.\n\nThe Foundation carries this work forward through its library, its teaching programmes and its clinical practice, ensuring that classical principles are preserved and applied in a contemporary setting.",
    author: "Dr. Ananya Deshpande",
    category: "Vaidya R. B. Gogate",
    date: "2026-08-15",
    featured: true,
    readingTime: "6 min read",
    tags: ["Legacy", "Classical Ayurveda", "Education"],
  },
  {
    id: "art-002",
    title: "Research Methods for Ayurveda Scholars",
    slug: "research-methods-for-ayurveda-scholars",
    excerpt:
      "A practical guide for postgraduate students designing their first research study in Ayurveda.",
    content:
      "Research in Ayurveda sits at the intersection of classical scholarship and modern scientific method. The Foundation's research methodology workshops help scholars navigate this space.\n\nA sound study begins with a clearly framed research question, situated within both the classical literature and the modern evidence base. Good scholarship respects both traditions of knowledge.\n\nThis article introduces the essential elements of study design — objectives, hypothesis, sample, intervention, controls and ethical approval — as taught in our workshop series.",
    author: "Dr. Nitin Patil",
    category: "Research",
    date: "2026-07-22",
    readingTime: "8 min read",
    tags: ["Research", "Scholarship"],
  },
  {
    id: "art-003",
    title: "The Art of Panchakarma: A Clinical Perspective",
    slug: "art-of-panchakarma-clinical-perspective",
    excerpt:
      "Understanding the classical basis of Panchakarma and its role in contemporary clinical practice.",
    content:
      "Panchakarma remains one of the most distinctive offerings of Ayurveda — a systematic approach to bio-purification that has been refined over centuries.\n\nIn the classical understanding, Panchakarma is not a commodity procedure but a carefully sequenced therapeutic process in which preparation, duration and follow-up are individually determined.\n\nThis article explores the classical basis of each of the five procedures and offers clinical guidance drawn from the Foundation's Panchakarma Centre experience.",
    author: "Vaidya Sunil Khandekar",
    category: "Ayurveda",
    date: "2026-06-30",
    readingTime: "10 min read",
    tags: ["Panchakarma", "Clinical Practice"],
  },
  {
    id: "art-004",
    title: "Ayurveda Education: Looking Ahead",
    slug: "ayurveda-education-looking-ahead",
    excerpt:
      "Thoughts on how Ayurveda education must evolve while remaining true to its traditions.",
    content:
      "Education is the Foundation's most important work. How Ayurveda is taught today will determine how it is practised tomorrow.\n\nThe Foundation believes that a contemporary Ayurveda curriculum must combine deep textual grounding with rigorous clinical training and modern research literacy.\n\nWe continue to work with partner institutions to develop teaching materials, mentorship networks and continuing education programmes that serve students throughout their careers.",
    author: "Dr. Meera Joshi",
    category: "Education",
    date: "2026-05-18",
    readingTime: "7 min read",
    tags: ["Education", "Curriculum"],
  },
  {
    id: "art-005",
    title: "From Our Archives: The Early Years of VGMF",
    slug: "from-our-archives-early-years-vgmf",
    excerpt:
      "A look back at the founding of the Foundation and the people who built its early legacy.",
    content:
      "The Vaidya Gogate Memorial Foundation was established to honour the life and work of Vaidya R. B. Gogate. Its early years were shaped by his colleagues, students and family members who gave their time and resources to build an institution.\n\nThe first lecture hall, the original library collection and the earliest community health programmes all began as modest efforts sustained by committed volunteers.\n\nOur archives preserve the photographs, letters and documents of these early years, and we share highlights as part of our ongoing anniversary programme.",
    author: "VGMF Archives",
    category: "Foundation",
    date: "2026-04-10",
    readingTime: "5 min read",
    tags: ["History", "Foundation"],
  },
  {
    id: "art-006",
    title: "Medicinal Plants: Cultivation and Conservation",
    slug: "medicinal-plants-cultivation-conservation",
    excerpt:
      "The Foundation's role in supporting the cultivation and conservation of medicinal plants used in Ayurveda.",
    content:
      "The availability of authentic medicinal plant material is fundamental to the integrity of Ayurveda. Over recent decades, pressure on wild populations has made conservation and ethical cultivation urgent.\n\nThe Foundation supports herb garden projects, works with grower networks and encourages the use of responsibly sourced material in clinical practice.\n\nThis article outlines the species most commonly in demand and the steps practitioners can take to ensure a sustainable supply chain.",
    author: "Dr. Ananya Deshpande",
    category: "Research",
    date: "2026-03-25",
    readingTime: "9 min read",
    tags: ["Herbs", "Conservation"],
  },
];

export function getArticleBySlug(slug: string) {
  return articles.find((article) => article.slug === slug);
}

export function getFeaturedArticles() {
  return articles.filter((article) => article.featured);
}