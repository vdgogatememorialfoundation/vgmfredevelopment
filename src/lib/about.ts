import { subscribeCms } from "@/lib/cms";
import { useSyncExternalStore } from "react";

const KEY = "vgmf_about";
/** Bump when default copy changes so stale browser drafts do not keep invented text. */
export const ABOUT_REVISION = 3;

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

export type AboutEssay = {
  title: string;
  intro: string;
  biography: string;
  portrait?: string;
};

export type AboutListPage = {
  title: string;
  intro: string;
  items: AboutSection[];
};

export type AboutScholarship = {
  title: string;
  intro: string;
  booksTitle: string;
  books: string[];
  researchTitle: string;
  research: string[];
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
    biographyMr: string;
    philosophy: string;
    timeline: TimelineEntry[];
    treeTitle: string;
    treeIntro: string;
    tree: FamilyNode[];
  };
  anagha: AboutEssay;
  awards: AboutListPage;
  scholarship: AboutScholarship;
};

const RB_BIOGRAPHY_EN = `Vd. R. B. Gogate was born on 4th February, 1933 at Atkar gaon and passed away on 28th September, 2015 at Pune. He received his GFAM — General Fellow of Ayurvedic Medicine (BOM) — and AVP — Ayur Vidya Parangat in Shalya-Shalakya — from Pune, the degrees for Ayurved graduation and post-graduation at that time. His OPD was functional till his last days.

He worked as a professor for post-graduate studies (Pune University), Director — Research and publication (Sane Guruji Arogya Kendra, Hadapsar), Principal (Tilak Ayurved Mahavidyalaya), Hon. Surgeon and HOD (Seth Tarachand Ramnath Hospital, Pune), C.M.O. (Matru Mandir Hospital, Devrukh), C.M.O. (Seth Tarachand Ramnath Hospital, Pune), Staff casualty officer (Civil Defence, Pune), Chief of AIDS research centre (STRC Hospital, Pune) and Chief of Cancer project (Pethe Arogya Kendra, Belgaum).

He worked as a consultant for Dnyanadevi trust (Pune), National AIDS Research Institute, Strategy planning committee — Ayurved, Septical Executive officer (Government of Maharashtra) and at the Pain management clinic (C.G.S. Pune).

He had done extensive research on AIDS, cancer, Agnikarma, Viddhakarma, dhoopan chikitsa in vrana, cauterisation of corns by Ayurvedic method, and raktamokshan, to name a few. He has published various books covering a large number of subjects like AIDS, Viddha and Agnikarma, Bhagna and Asthi roga, Shalya tantra and Hasti ayurved.

His work has been recognised and awarded by many institutions. The most recent award, the Pandit Ramnarayan Sharma Award for research in Ayurved (Baidyanath), was received by his son Ar. Padmanabha Gogate at the hands of the honourable President of India Shri Ramnath Kovind. His other awards include Sushrut Puraskar (Khadiwale Vaidya Sanstha), Gayatri Pratishthan Puraskar for work on AIDS, Legend Shalaki Karyabhushan Puraskar, and Jivan Gaurav Puraskar (TAMV, RSM).

His work is still carried forward by his students at his clinic and several other locations across India.`;

const RB_BIOGRAPHY_MR = `आदरणीय व वंदनीय माणसे दुर्मिळ होत असताना वैद्य रामचंद्र बल्लाळ गोगटे यांचे नाव दुर्मिळ व्यक्ती म्हणून अग्रक्रमाने व प्राधान्याने घ्यावे लागेल.

४ फेब्रुवारी १९३३ रोजी जन्मलेले वैद्य रामचंद्र गोगटे हे परमेश्वराचा अवतार घेऊन इहलोकी अवतरले असेच म्हणावे लागेल. त्यांचा एकून जीवनप्रवास पाहिल्यास त्याची प्रचिती येते. त्यांनी रामचंद्र हे नाव सार्थ केले. त्यांचे वैद्यकीय ज्ञान व कौशल्य वादातीत व सर्वश्रुत आहेच; पण ज्ञानसंपन्न असूनही निगर्वी स्वभाव, उच्चपदस्थ असून सर्वसामान्यांशी जोडलेली नाळ, हसतमुख चेहरा, सेवाभावी वृत्ती आणि विद्वत्ता असून अवघड विषय सोपा करून सांगण्याची त्यांची हातोटी ही त्यांची प्रमुख वैशिष्ट्ये सांगता येतील.

ताराचंद हॉस्पिटल मध्ये त्यांनी ज्या आपलेपणाने काम केले तसे देवरुख सारख्या ग्रामीण भागात केले. कामाप्रती निष्ठा, त्यासाठी करावे लागणारे कष्ट, जिद्द व धडाडी त्यांच्याजवळ होती. ते कार्यमग्न असताना एक ज्ञानमय तपस्वी पहात असल्यासारखे वाटे. आळस हा शब्द त्यांच्या शब्दकोषात नव्हता. त्यांच्यात एवढी ऊर्जा व उत्साह कुठून येते असा प्रश्न पडत असे.

त्यांचे व्यक्तिमत्व चतुरस्त्र व बहुआयामी होते. प्रत्येक गोष्टीत परिपूर्णतेचा ध्यास व तळमळ होती. त्यांना नाट्यगीताची आवड होती व बागकामाचा छंद होता. ते रिकामे बसलेले कधी दिसत नसत. डॉक्टर लोकांचे हस्ताक्षर हा विनोदाचा विषय असताना ते मात्र अपवाद होते. त्यांचे हस्ताक्षर सुवाच्य व वळणदार होते. चित्रकलेचे अंग असल्याने रेखीव आकृत्या शोभून दिसत असत.

त्यांचे वैद्यकीय निदान व उपचार यावर त्यांच्या रुग्णांची अमाप श्रद्धा असल्याने पेशंट दुसर्‍या डॉक्टरकडे न जाता वेळ लागला तरी त्यांच्याकडेच येत असत. ते यशामागे न धावता यश त्यांच्यामागे धावत येत होते. त्यांना सुश्रुत पुरस्कार, गायत्री प्रतिष्ठान पुरस्कार, सुप्रसिद्ध शालाक्य कार्यभूषण पुरस्कार, जीवनगौरव पुरस्कार, राष्ट्रपतींच्या हस्ते दिला जाणारा पं. रामनारायण शर्मा पुरस्कार यासारख्या अनेक पुरस्कारांनी सन्मानित करण्यात आले.

आयुर्वेदिक दिनचर्या कशी योग्य आहे, निसर्गाच्या विरुद्ध जाऊन आधुनिक जीवनशैलीने व व्यसनांमुळे रोगांना आपण कसे जवळ करतो हे ते छान समजावून देत.

रक्तमोक्षण, अग्निकर्म अशा आयुर्वेदिक चिकित्सेने अनेक रोग्यांच्या जीवनात त्यांच्या दुर्धर व्याधी दूर करून आनंद फ़ुलवला. कॅन्सर रिसर्चमध्ये त्यांनी मोलाचे कार्य केले आहे. निष्णात वैद्य, तज्ञ आणि विद्यार्थीप्रिय शिक्षक असा त्यांचा लौकिक! कृतार्थ जीवन कसे जगावे याचा वस्तुपाठ त्यांनी आपल्या आचरणातून घालून दिला. त्याबद्दल आपण त्यांचे सदैव ऋणी असू. त्यांची जीवनशैली लिहिण्यास सोपी पण आचरणात आणण्यास तेवढीच अवघड.

मरावे परी कीर्तिरूपे उरावे हे त्यांच्या बाबतीत अगदी तंतोतंत खरे ठरते. ते देहरूपाने आज आपल्यात नसले तरी कार्यरूपाने आपल्यातच आहेत. त्यांच्याकडून प्रेरणा घेऊन अनेकजण आपापल्या परीने खारीचा वाटा उचलत त्यांचे कार्य पुढे नेत आहेत.

- विदुला गोगटे`;

const ANAGHA_BIOGRAPHY = `The most significant contribution in terms of unwavering support and strength to Dr. Ramchandra B. Gogate was made by his wife, Dr. Anagha Ramchandra Gogate.

She was born on 7th November 1936 to Mr. Gajanan and Indira Sahasrabuddhe in Panchgani, Satara district of Maharashtra.

Being a daughter of a teacher father who then worked in Sanjeevan Vidyalaya school, Dr. Anagha — then called Hira — grew up in an education-friendly and constructivism-oriented environment. She did her schooling from Sanjeevan Vidyalaya, Panchgani, and moved to Pune in 1950 for her higher secondary studies in Fergusson College. She was later admitted to Tilak Ayurved Mahavidyalaya for BAMS, where she pursued her bachelor's degree in Ayurvedic sciences. She excelled in academics all throughout her student life and thereafter.

She married Dr. Ramchandra Ballal Gogate on 21st May 1963.

She worked as an MO in Matrumandir from 1968–69 and as a clinical assistant from 1968–69. She received enormous appreciation in teaching as a professor in Tilak Ayurved Mahavidyalaya from 1970 onwards. From shifting towns with him, making all the necessary sacrifices for the family to take care of children and in-laws, giving up on ambitions and dreams, to being the strongest pillar to her husband so that he could continue to serve the people and community without any hassles and hurdles, she left no stone unturned to support him.

In spite of immense responsibilities and difficulties that she had, she continued to share his work and role as and when possible, to the best of her abilities, without a single complaint. She continued to be an epitome of love, care and resilience. We lost her on 12th September 2019 after her long-standing battle with prolonged illness. She will always be remembered for being remarkably virtuous and dutiful, with an incomparable will to stand by her husband through any odds.`;

export const ABOUT_NAV = [
  { href: "/about", key: "nav.about" },
  { href: "/about/foundation", key: "nav.aboutFoundation" },
  { href: "/about/legacy-of-vaidya-rb-gogate", key: "nav.aboutLegacy" },
  { href: "/about/dr-anagha-gogate", key: "nav.aboutAnagha" },
  { href: "/about/awards", key: "nav.aboutAwards" },
  { href: "/about/books-and-research", key: "nav.aboutBooks" },
  { href: "/about/history", key: "nav.aboutHistory" },
  { href: "/about/trustees", key: "nav.aboutTrustees" },
] as const;

export function firstPhoto(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

export function rbPortrait(about: Pick<AboutContent, "heroImage" | "legacy">) {
  return firstPhoto(about.legacy?.portrait, about.heroImage, "/about/rb-gogate.jpg");
}

export function anaghaPortrait(about: Pick<AboutContent, "anagha">) {
  return firstPhoto(about.anagha?.portrait, "/about/anagha-gogate.jpg");
}

export const defaultAbout: AboutContent = {
  revision: ABOUT_REVISION,
  title: "About Vaidya Gogate Memorial Foundation",
  heroImage: "/about/rb-gogate.jpg",
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
      body: "English and Marathi biography of Vd. Ramchandra Ballal Gogate — physician, teacher, researcher, and the grandfather whose work this platform shares.",
      href: "/about/legacy-of-vaidya-rb-gogate",
    },
    {
      id: "s-anagha",
      title: "Dr. Anagha Gogate",
      body: "Dr. Anagha Ramchandra Gogate (1936–2019) stood beside Vd. R. B. Gogate as physician, teacher and the strongest pillar of the family.",
      href: "/about/dr-anagha-gogate",
    },
    {
      id: "s-awards",
      title: "Awards & Accolades",
      body: "Sushrut Puraskar, Gayatri Pratishthan Puraskar, Legend Shalaki Karyabhushan Puraskar, Jivan Gaurav Puraskar, and the Pandit Ramnarayan Sharma Award received at the hands of the President of India.",
      href: "/about/awards",
    },
    {
      id: "s-books",
      title: "Books & Research",
      body: "Books on AIDS, Viddha and Agnikarma, Bhagna and Asthi roga, Shalya tantra and Hasti ayurved, with research in cancer, raktamokshan and dhoopan chikitsa.",
      href: "/about/books-and-research",
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
        body: "Research methodology training, clinical studies and scholarly articles.",
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
        year: "1933 – 2015",
        title: "Vd. Ramchandra Ballal Gogate",
        description:
          "Born on 4th February 1933 at Atkar gaon. GFAM and AVP in Shalya-Shalakya. Physician, teacher, researcher. Passed away on 28th September 2015 at Pune.",
      },
      {
        id: "h-anagha",
        year: "1936 – 2019",
        title: "Dr. Anagha Ramchandra Gogate",
        description:
          "Born 7th November 1936 in Panchgani. Married Vd. R. B. Gogate on 21st May 1963. Professor at Tilak Ayurved Mahavidyalaya from 1970. Passed away on 12th September 2019.",
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
    portrait: "/about/rb-gogate.jpg",
    intro:
      "Vd. Ramchandra Ballal Gogate — Vaidya Ramchandra Ballal Gogate — was born on 4th February 1933 at Atkar gaon and passed away on 28th September 2015 at Pune. This page shares his English biography, the Marathi remembrance by Vidula Gogate, and the posts, research and awards that still carry his work forward.",
    biography: RB_BIOGRAPHY_EN,
    biographyMr: RB_BIOGRAPHY_MR,
    philosophy:
      "His vision is ‘knowledge for all’. Vaidya Gogate Memorial Foundation’s sole motto is Propagation of knowledge — an authentic source of information, to ignite young minds through his writings and teachings, and to reach vaidyas, students of Ayurved, all pathies and common people.",
    timeline: [
      {
        id: "t-1933",
        year: "1933",
        title: "Born at Atkar gaon",
        description: "4th February 1933.",
      },
      {
        id: "t-degrees",
        year: "Studies",
        title: "GFAM and AVP, Pune",
        description: "General Fellow of Ayurvedic Medicine (BOM) and Ayur Vidya Parangat in Shalya-Shalakya — the graduation and post-graduation degrees of that time.",
      },
      {
        id: "t-1963",
        year: "1963",
        title: "Marriage to Dr. Anagha Gogate",
        description: "21st May 1963.",
      },
      {
        id: "t-posts",
        year: "Service",
        title: "Teacher, surgeon and chief medical officer",
        description:
          "Professor for post-graduate studies (Pune University); Principal, Tilak Ayurved Mahavidyalaya; Hon. Surgeon and HOD, Seth Tarachand Ramnath Hospital, Pune; C.M.O., Matru Mandir Hospital, Devrukh; Chief of AIDS research centre, STRC Hospital, Pune; Chief of Cancer project, Pethe Arogya Kendra, Belgaum.",
      },
      {
        id: "t-research",
        year: "Research",
        title: "AIDS, cancer, Agnikarma and Viddhakarma",
        description:
          "Extensive research on AIDS, cancer, Agnikarma, Viddhakarma, dhoopan chikitsa in vrana, cauterisation of corns by Ayurvedic method, and raktamokshan.",
      },
      {
        id: "t-2015",
        year: "2015",
        title: "Passed away in Pune",
        description: "28th September 2015. His OPD remained functional till his last days. Students still carry the work forward at his clinic and across India.",
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
        years: "1933 – 2015",
        note: "Grandfather whose work this platform shares. His grandchildren created this site on behalf of the Gogate family.",
      },
      {
        id: "f-anagha",
        name: "Dr. Anagha Ramchandra Gogate",
        relation: "Wife of Vd. R. B. Gogate",
        years: "1936 – 2019",
        note: "Physician, teacher, and the strongest pillar beside him.",
      },
    ],
  },
  anagha: {
    title: "Dr. Anagha Gogate",
    portrait: "/about/anagha-gogate.jpg",
    intro:
      "Dr. Anagha Ramchandra Gogate (7th November 1936 – 12th September 2019) gave unwavering support and strength to Vd. Ramchandra B. Gogate.",
    biography: ANAGHA_BIOGRAPHY,
  },
  awards: {
    title: "Awards & Accolades",
    intro:
      "Vd. R. B. Gogate’s work has been recognized and awarded by many institutions. The most recent award, the Pandit Ramnarayan Sharma Award for research in Ayurved (Baidyanath), was received by his son Ar. Padmanabha Gogate at the hands of the honourable President of India Shri Ramnath Kovind.",
    items: [
      {
        id: "aw-president",
        title: "Pandit Ramnarayan Sharma Award",
        body: "For research in Ayurved (Baidyanath). Received by Ar. Padmanabha Gogate at the hands of the honourable President of India Shri Ramnath Kovind.",
      },
      {
        id: "aw-sushrut",
        title: "Sushrut Puraskar",
        body: "Khadiwale Vaidya Sanstha.",
      },
      {
        id: "aw-gayatri",
        title: "Gayatri Pratishthan Puraskar",
        body: "For work on AIDS.",
      },
      {
        id: "aw-shalaki",
        title: "Legend Shalaki Karyabhushan Puraskar",
        body: "In recognition of his work in Shalakya.",
      },
      {
        id: "aw-jivan",
        title: "Jivan Gaurav Puraskar",
        body: "TAMV, RSM.",
      },
    ],
  },
  scholarship: {
    title: "Books & Research",
    intro:
      "Vd. R. B. Gogate published books across a wide range of subjects and carried out extensive clinical research. The Foundation shares articles from this body of work — we publish articles, not journals.",
    booksTitle: "Books",
    books: ["AIDS", "Viddha and Agnikarma", "Bhagna and Asthi roga", "Shalya tantra", "Hasti ayurved"],
    researchTitle: "Research",
    research: [
      "AIDS",
      "Cancer",
      "Agnikarma",
      "Viddhakarma",
      "Dhoopan chikitsa in vrana",
      "Cauterisation of corns by Ayurvedic method",
      "Raktamokshan",
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
    anagha: {
      ...defaultAbout.anagha,
      portrait: saved?.anagha?.portrait || defaultAbout.anagha.portrait,
    },
  };
}

function merge(saved: Partial<AboutContent> | null): AboutContent {
  if (!saved || (saved.revision ?? 0) < ABOUT_REVISION) return mergeMedia(saved);
  return {
    ...defaultAbout,
    ...saved,
    revision: ABOUT_REVISION,
    heroImage: saved.heroImage || defaultAbout.heroImage,
    sections: saved.sections ?? defaultAbout.sections,
    gallery: saved.gallery ?? defaultAbout.gallery,
    foundation: { ...defaultAbout.foundation, ...(saved.foundation ?? {}) },
    history: { ...defaultAbout.history, ...(saved.history ?? {}) },
    trustees: { ...defaultAbout.trustees, ...(saved.trustees ?? {}) },
    legacy: {
      ...defaultAbout.legacy,
      ...(saved.legacy ?? {}),
      portrait: saved.legacy?.portrait || defaultAbout.legacy.portrait,
    },
    anagha: {
      ...defaultAbout.anagha,
      ...(saved.anagha ?? {}),
      portrait: saved.anagha?.portrait || defaultAbout.anagha.portrait,
    },
    awards: { ...defaultAbout.awards, ...(saved.awards ?? {}) },
    scholarship: { ...defaultAbout.scholarship, ...(saved.scholarship ?? {}) },
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
