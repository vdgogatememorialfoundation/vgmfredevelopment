import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";

export const metadata: Metadata = {
  title: "History",
  description:
    "The history of the Vaidya Gogate Memorial Foundation — from its founding to the programmes it runs today.",
};

const timeline = [
  {
    year: "1935",
    title: "R. B. Gogate begins practice",
    description:
      "Vaidya R. B. Gogate begins his lifelong practice of Ayurveda, combining classical study with clinical care.",
  },
  {
    year: "1958",
    title: "Early teaching & mentorship",
    description:
      "Gogate begins formally teaching and mentoring the next generation of Ayurveda physicians.",
  },
  {
    year: "1974",
    title: "Publication of classical works",
    description:
      "His landmark pharmacology texts are published, preserving classical formulations for future practitioners.",
  },
  {
    year: "1992",
    title: "Foundation established",
    description:
      "Following Vaidya R. B. Gogate's passing, the Foundation is established by his family, colleagues and students.",
  },
  {
    year: "2001",
    title: "First clinic & library",
    description:
      "The Foundation opens its first clinic and public library dedicated to classical Ayurveda texts.",
  },
  {
    year: "2026",
    title: "Education, research & digital services",
    description:
      "The Foundation runs seminars, fellowships, clinics, publications and digital services, including account, event and certificate management.",
  },
];

export default function HistoryPage() {
  return (
    <main>
      <PageHeader
        eyebrow="About Us"
        title="Our History"
        description="From the legacy of a single physician to a modern institution of education, research and care."
        breadcrumb={[{ name: "About", href: "/about" }]}
      />

      <section className="section bg-background">
        <div className="container max-w-4xl">
          <ol className="relative space-y-10 border-l-2 border-border pl-8" role="list">
            {timeline.map((item) => (
              <li key={item.year} className="relative">
                <span
                  className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-burgundy bg-white"
                  aria-hidden="true"
                >
                  <span className="h-2 w-2 rounded-full bg-burgundy" />
                </span>

                <p className="text-sm font-bold uppercase tracking-[0.15em] text-burgundy">
                  {item.year}
                </p>
                <h2 className="heading-3 mt-1">{item.title}</h2>
                <p className="mt-2 text-body">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}