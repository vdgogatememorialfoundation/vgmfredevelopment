import { subscribeCms } from "@/lib/cms";
import { useSyncExternalStore } from "react";

const KEY = "vgmf_about";

export type AboutSection = { id: string; title: string; body: string; image?: string; href?: string };
export type AboutPhoto = { id: string; src: string; title: string; description: string };
export type TimelineEntry = { id: string; year: string; title: string; description: string };
export type FamilyNode = {
  id: string;
  parentId?: string;
  name: string;
  relation: string;
  years?: string;
  photo?: string;
  note?: string;
};

export type AboutContent = {
  title: string;
  intro: string;
  heroImage?: string;
  sections: AboutSection[];
  gallery: AboutPhoto[];
  legacy: {
    title: string;
    intro: string;
    portrait?: string;
    biography: string;
    philosophy: string;
    timeline: TimelineEntry[];
    treeTitle: string;
    treeIntro: string;
    tree: FamilyNode[];
  };
};

export const defaultAbout: AboutContent = {
  title: "About the Foundation",
  intro:
    "Vaidya Gogate Memorial Foundation preserves the classical traditions of Ayurveda, advances knowledge through education and research, and serves society through clinical and community programmes.",
  sections: [
    { id: "s-foundation", title: "About the Foundation", body: "Our mission, vision and programmes — from clinical care to research and publication.", href: "/about/foundation" },
    { id: "s-legacy", title: "Legacy of Vaidya R. B. Gogate", body: "The life, scholarship and enduring influence of the physician and teacher the Foundation honours.", href: "/about/legacy-of-vaidya-rb-gogate" },
    { id: "s-history", title: "Our History", body: "How the Foundation was established and the efforts that shaped its early years.", href: "/about/history" },
    { id: "s-trustees", title: "Trustees & Team", body: "The trustees, scholars and staff who guide and carry forward the Foundation's work.", href: "/about/trustees" },
  ],
  gallery: [],
  legacy: {
    title: "The Legacy of Vaidya R. B. Gogate",
    intro:
      "Vaidya R. B. Gogate was a physician, teacher and scholar whose life exemplified the highest ideals of classical Ayurveda. The Foundation built in his memory is a living continuation of that work.",
    biography:
      "Vaidya R. B. Gogate devoted his life to the study, practice and teaching of Ayurveda. He believed that classical knowledge was not a relic of the past but a living science — one that must be practised with precision, taught with care and examined with scholarly rigour.\n\nHis approach combined a deep reverence for the classical samhitas with an openness to systematic observation and scientific inquiry. He treated colleagues, students and patients alike with respect, and he held himself to the highest standard of intellectual honesty.",
    philosophy:
      "Gogate's philosophy was simple and enduring: preserve what is true, teach what you know, and serve those who need help. Those three commitments — preservation, education and service — continue to define the Foundation that bears his name.",
    timeline: [
      { id: "t1", year: "1912", title: "Early Life", description: "Born into a family with a deep tradition of learning, R. B. Gogate developed an early passion for the classical sciences of India." },
      { id: "t2", year: "1930", title: "Education", description: "Trained in classical Ayurveda under respected teachers, mastering the samhitas and the practical clinical arts." },
      { id: "t3", year: "1935", title: "Ayurveda Practice", description: "Began a lifetime of clinical practice combining deep textual grounding with careful, systematic observation of patients." },
      { id: "t4", year: "1952", title: "Research & Scholarship", description: "Conducted and published research on classical formulations, drawing attention to the scientific basis of Ayurveda." },
      { id: "t5", year: "1974", title: "Publications", description: "Published landmark works including his renowned pharmacology texts, preserving classical knowledge for future generations." },
      { id: "t6", year: "1985", title: "Teaching", description: "Trained and mentored a generation of physicians, emphasising integrity, precision and lifelong learning." },
    ],
    treeTitle: "Family & lineage",
    treeIntro: "The family and the line of teachers and students who carry the tradition forward.",
    tree: [
      { id: "f-root", name: "Vaidya R. B. Gogate", relation: "Founder of the tradition", years: "1912 – " },
    ],
  },
};

function merge(saved: Partial<AboutContent> | null): AboutContent {
  if (!saved) return defaultAbout;
  return { ...defaultAbout, ...saved, legacy: { ...defaultAbout.legacy, ...(saved.legacy ?? {}) } };
}

export function getAbout(): AboutContent {
  if (typeof window === "undefined") return defaultAbout;
  try {
    const raw = window.localStorage.getItem(KEY);
    return merge(raw ? (JSON.parse(raw) as Partial<AboutContent>) : null);
  } catch {
    return defaultAbout;
  }
}

export function saveAbout(content: AboutContent) {
  window.localStorage.setItem(KEY, JSON.stringify(content));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function resetAbout() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("vgmf-cms"));
}

let cachedRaw: string | null = null;
let cachedValue: AboutContent = defaultAbout;

export function useAbout(): AboutContent {
  return useSyncExternalStore(
    subscribeCms,
    () => {
      const raw = window.localStorage.getItem(KEY);
      if (raw === cachedRaw) return cachedValue;
      cachedRaw = raw;
      cachedValue = getAbout();
      return cachedValue;
    },
    () => defaultAbout
  );
}

export type TreeBranch = FamilyNode & { children: TreeBranch[] };

export function buildTree(nodes: FamilyNode[]): TreeBranch[] {
  const byId = new Map<string, TreeBranch>(nodes.map((node) => [node.id, { ...node, children: [] }]));
  const roots: TreeBranch[] = [];
  for (const branch of byId.values()) {
    const parent = branch.parentId ? byId.get(branch.parentId) : undefined;
    if (parent && parent.id !== branch.id) parent.children.push(branch);
    else roots.push(branch);
  }
  return roots;
}
