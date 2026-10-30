import { subscribeCms } from "@/lib/cms";
import { useSyncExternalStore } from "react";

const KEY = "vgmf_about";
/** Bump when default copy changes so stale browser drafts do not keep invented text. */
export const ABOUT_REVISION = 2;

export type AboutSection = { id: string; title: string; body: string; image?: string; href?: string };
export type AboutPhoto = { id: string; src: string; title: string; description: string };
export type TimelineEntry = { id: string; year: string; title: string; description: string };
export type AboutPerson = { id: string; name: string; role: string; bio?: string; photo?: string };
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
  revision?: number;
  title: string;
  intro: string;
  heroImage?: string;
  sections: AboutSection[];
  gallery: AboutPhoto[];
  foundation: {
    title: string;
    intro: string;
    sections: AboutSection[];
    activities: AboutSection[];
  };
  history: {
    title: string;
    intro: string;
    timeline: TimelineEntry[];
  };
  trustees: {
    title: string;
    intro: string;
    trusteesHeading: string;
    teamHeading: string;
    trustees: AboutPerson[];
    team: AboutPerson[];
  };
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
  revision: ABOUT_REVISION,
  title: "About Vaidya Gogate Memorial Foundation",
  intro:
    "Vaidya Gogate Memorial Foundation is a website with a sole motto: Propagation of knowledge. This is a platform to share our grandfather’s, Vd. Ramchandra Ballal Gogate’s work and carry forward his vision ‘knowledge for all’. We are creating this platform as an authentic source of information. Our purpose is to ignite young minds through his writings and teachings. We plan to reach out to all vaidyas, students of Ayurved as well as disseminating the knowledge across all pathies and common people. Fortunately, our family has been blessed with renowned vaidyas for many generations.\n\nStarting from Vd. Mahadev (Bapu) Gogate who was the rajavaidya to the king of Jawhar, next generation being Vd. Vishnu Mahadev Gogate (Dravyaguna) and Vd. Trimbak Mahadev Gogate (Panchakarma), next generation being Vd. Ramchandra Ballal Gogate (Shalya tantra), and this legacy still continues. They have made huge contributions to the field of Ayurved of which many remain under appreciated. This website is in their honor and remembrance. We intend to pass on the wisdom of these great professors. Vd. R. B. Gogate will always inspire us, not only as a grandfather but also through his lifetime of study, work and research.\n\nWe, his grandchildren on behalf of the Gogate family are creating this platform to promote our grandfather’s lifetime work and for our strong passion towards the field of Ayurved. We would definitely love to have your suggestions, guidelines and support in our endeavour!\n\nRegards,\nthe grandchildren of Vd. R. B. Gogate, on behalf of the Gogate family",
  sections: [
    {
      id: "s-foundation",
      title: "About the Foundation",
      body: "A platform with a sole motto — Propagation of knowledge — sharing Vd. Ramchandra Ballal Gogate’s work and carrying forward his vision ‘knowledge for all’.",
      href: "/about/foundation",
    },
    {
      id: "s-legacy",
      title: "Legacy of Vaidya R. B. Gogate",
      body: "Vd. R. B. Gogate (Shalya tantra) inspires this Foundation as a grandfather and through his lifetime of study, work and research.",
      href: "/about/legacy-of-vaidya-rb-gogate",
    },
    {
      id: "s-history",
      title: "Our History",
      body: "Renowned vaidyas for many generations: Vd. Mahadev (Bapu) Gogate, Vd. Vishnu Mahadev Gogate, Vd. Trimbak Mahadev Gogate, and Vd. Ramchandra Ballal Gogate.",
      href: "/about/history",
    },
    {
      id: "s-trustees",
      title: "Trustees & Team",
      body: "His grandchildren, on behalf of the Gogate family, are creating this platform. Suggestions, guidelines and support are welcome.",
      href: "/about/trustees",
    },
  ],
  gallery: [],
  foundation: {
    title: "About the Foundation",
    intro:
      "Vaidya Gogate Memorial Foundation is a website with a sole motto: Propagation of knowledge. This is a platform to share our grandfather’s, Vd. Ramchandra Ballal Gogate’s work and carry forward his vision ‘knowledge for all’. We are creating this platform as an authentic source of information.",
    sections: [
      {
        id: "f-purpose",
        title: "Our purpose",
        body: "Our purpose is to ignite young minds through his writings and teachings. We plan to reach out to all vaidyas, students of Ayurved as well as disseminating the knowledge across all pathies and common people.",
      },
      {
        id: "f-family",
        title: "A family of vaidyas",
        body: "Fortunately, our family has been blessed with renowned vaidyas for many generations. They have made huge contributions to the field of Ayurved of which many remain under appreciated. This website is in their honor and remembrance. We intend to pass on the wisdom of these great professors.",
      },
      {
        id: "f-invitation",
        title: "From the family",
        body: "We, his grandchildren on behalf of the Gogate family are creating this platform to promote our grandfather’s lifetime work and for our strong passion towards the field of Ayurved. We would definitely love to have your suggestions, guidelines and support in our endeavour!",
      },
    ],
    activities: [
      {
        id: "a-clinical",
        title: "Clinical Practice",
        body: "Foundation clinics offering general Ayurveda consultation, Panchakarma therapy and community health programmes.",
        href: "/clinics",
      },
      {
        id: "a-education",
        title: "Education & Training",
        body: "Seminars, workshops, fellowship programmes and continuing education for physicians and students.",
        href: "/events",
      },
      {
        id: "a-research",
        title: "Research & Scholarship",
        body: "Research methodology training, clinical studies and scholarly publications.",
        href: "/articles",
      },
      {
        id: "a-publications",
        title: "Publications",
        body: "Clinical references, biographies and scholarly works available through our online store.",
        href: "/shop",
      },
    ],
  },
  history: {
    title: "Our History",
    intro:
      "Fortunately, our family has been blessed with renowned vaidyas for many generations. They have made huge contributions to the field of Ayurved of which many remain under appreciated. This website is in their honor and remembrance.",
    timeline: [
      {
        id: "h1",
        year: "Lineage",
        title: "Vd. Mahadev (Bapu) Gogate",
        description: "Rajavaidya to the king of Jawhar.",
      },
      {
        id: "h2",
        year: "Next generation",
        title: "Vd. Vishnu Mahadev Gogate and Vd. Trimbak Mahadev Gogate",
        description: "Vd. Vishnu Mahadev Gogate (Dravyaguna) and Vd. Trimbak Mahadev Gogate (Panchakarma).",
      },
      {
        id: "h3",
        year: "Next generation",
        title: "Vd. Ramchandra Ballal Gogate",
        description:
          "Shalya tantra. Vd. R. B. Gogate will always inspire us, not only as a grandfather but also through his lifetime of study, work and research.",
      },
      {
        id: "h4",
        year: "This platform",
        title: "Grandchildren of the Gogate family",
        description:
          "We, his grandchildren on behalf of the Gogate family are creating this platform to promote our grandfather’s lifetime work and for our strong passion towards the field of Ayurved.",
      },
    ],
  },
  trustees: {
    title: "Trustees & Team",
    intro:
      "We, his grandchildren on behalf of the Gogate family are creating this platform to promote our grandfather’s lifetime work and for our strong passion towards the field of Ayurved. We would definitely love to have your suggestions, guidelines and support in our endeavour!",
    trusteesHeading: "The Gogate family",
    teamHeading: "Our Team",
    trustees: [],
    team: [],
  },
  legacy: {
    title: "The Legacy of Vaidya R. B. Gogate",
    intro:
      "This platform shares our grandfather’s, Vd. Ramchandra Ballal Gogate’s work and carries forward his vision ‘knowledge for all’. This website is in honor and remembrance of the great professors of this family.",
    biography:
      "Vd. Ramchandra Ballal Gogate (Shalya tantra) belongs to a family blessed with renowned vaidyas for many generations — starting from Vd. Mahadev (Bapu) Gogate, rajavaidya to the king of Jawhar; then Vd. Vishnu Mahadev Gogate (Dravyaguna) and Vd. Trimbak Mahadev Gogate (Panchakarma).\n\nThey have made huge contributions to the field of Ayurved of which many remain under appreciated. We intend to pass on the wisdom of these great professors. Vd. R. B. Gogate will always inspire us, not only as a grandfather but also through his lifetime of study, work and research.",
    philosophy:
      "His vision is ‘knowledge for all’. Vaidya Gogate Memorial Foundation’s sole motto is Propagation of knowledge — an authentic source of information, to ignite young minds through his writings and teachings, and to reach vaidyas, students of Ayurved, all pathies and common people.",
    timeline: [
      {
        id: "t1",
        year: "Lineage",
        title: "Vd. Mahadev (Bapu) Gogate",
        description: "Rajavaidya to the king of Jawhar.",
      },
      {
        id: "t2",
        year: "Next generation",
        title: "Vd. Vishnu Mahadev Gogate",
        description: "Dravyaguna.",
      },
      {
        id: "t3",
        year: "Next generation",
        title: "Vd. Trimbak Mahadev Gogate",
        description: "Panchakarma.",
      },
      {
        id: "t4",
        year: "Next generation",
        title: "Vd. Ramchandra Ballal Gogate",
        description: "Shalya tantra. Grandfather whose lifetime of study, work and research this platform shares.",
      },
    ],
    treeTitle: "Family & lineage",
    treeIntro:
      "Renowned vaidyas for many generations, in whose honor and remembrance this website is created.",
    tree: [
      { id: "f-mahadev", name: "Vd. Mahadev (Bapu) Gogate", relation: "Rajavaidya to the king of Jawhar" },
      { id: "f-vishnu", parentId: "f-mahadev", name: "Vd. Vishnu Mahadev Gogate", relation: "Dravyaguna" },
      { id: "f-trimbak", parentId: "f-mahadev", name: "Vd. Trimbak Mahadev Gogate", relation: "Panchakarma" },
      {
        id: "f-rb",
        name: "Vd. Ramchandra Ballal Gogate",
        relation: "Shalya tantra",
        note: "Grandfather whose work this platform shares. His grandchildren created this site on behalf of the Gogate family.",
      },
    ],
  },
};

function mergeMedia(saved: Partial<AboutContent> | null): AboutContent {
  const priorTree = saved?.legacy?.tree ?? [];
  return {
    ...defaultAbout,
    heroImage: saved?.heroImage || defaultAbout.heroImage,
    gallery: saved?.gallery?.length ? saved.gallery : defaultAbout.gallery,
    legacy: {
      ...defaultAbout.legacy,
      portrait: saved?.legacy?.portrait || defaultAbout.legacy.portrait,
      tree: defaultAbout.legacy.tree.map((node) => {
        const prior = priorTree.find((item) => item.id === node.id);
        return prior?.photo ? { ...node, photo: prior.photo } : node;
      }),
    },
  };
}

function merge(saved: Partial<AboutContent> | null): AboutContent {
  if (!saved || (saved.revision ?? 0) < ABOUT_REVISION) return mergeMedia(saved);
  return {
    ...defaultAbout,
    ...saved,
    revision: ABOUT_REVISION,
    sections: saved.sections ?? defaultAbout.sections,
    gallery: saved.gallery ?? defaultAbout.gallery,
    foundation: { ...defaultAbout.foundation, ...(saved.foundation ?? {}) },
    history: { ...defaultAbout.history, ...(saved.history ?? {}) },
    trustees: { ...defaultAbout.trustees, ...(saved.trustees ?? {}) },
    legacy: { ...defaultAbout.legacy, ...(saved.legacy ?? {}) },
  };
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
  window.localStorage.setItem(KEY, JSON.stringify({ ...content, revision: ABOUT_REVISION }));
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
