import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";

export const metadata: Metadata = {
  title: "Legacy of Vaidya R. B. Gogate",
  description:
    "The life, scholarship and enduring legacy of Vaidya R. B. Gogate — physician, teacher and pioneer of classical Ayurveda who inspired the Foundation.",
};

const timeline = [
  {
    year: "1912",
    title: "Early Life",
    description:
      "Born into a family with a deep tradition of learning, R. B. Gogate developed an early passion for the classical sciences of India.",
  },
  {
    year: "1930",
    title: "Education",
    description:
      "Trained in classical Ayurveda under respected teachers, mastering the samhitas and the practical clinical arts.",
  },
  {
    year: "1935",
    title: "Ayurveda Practice",
    description:
      "Began a lifetime of clinical practice combining deep textual grounding with careful, systematic observation of patients.",
  },
  {
    year: "1952",
    title: "Research & Scholarship",
    description:
      "Conducted and published research on classical formulations, drawing attention to the scientific basis of Ayurveda.",
  },
  {
    year: "1974",
    title: "Publications",
    description:
      "Published landmark works including his renowned pharmacology texts, preserving classical knowledge for future generations.",
  },
  {
    year: "1985",
    title: "Teaching",
    description:
      "Trained and mentored a generation of physicians, emphasising integrity, precision and lifelong learning.",
  },
];

export default function LegacyPage() {
  return (
    <main>
      <PageHeader
        eyebrow="About Us"
        title="The Legacy of Vaidya R. B. Gogate"
        description="Vaidya R. B. Gogate was a physician, teacher and scholar whose life exemplified the highest ideals of classical Ayurveda. The Foundation built in his memory is a living continuation of that work."
        breadcrumb={[{ name: "About", href: "/about" }]}
      />

      <section className="section bg-background">
        <div className="container grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="heading-3 mb-4">Biography</h2>
            <p className="text-body">
              Vaidya R. B. Gogate devoted his life to the study, practice and
              teaching of Ayurveda. He believed that classical knowledge was
              not a relic of the past but a living science — one that must
              be practised with precision, taught with care and examined
              with scholarly rigour.
            </p>

            <p className="text-body mt-4">
              His approach combined a deep reverence for the classical
              samhitas with an openness to systematic observation and
              scientific inquiry. He treated colleagues, students and
              patients alike with respect, and he held himself to the
              highest standard of intellectual honesty.
            </p>

            <h2 className="heading-3 mb-4 mt-10">Philosophy</h2>
            <p className="text-body">
              Gogate&apos;s philosophy was simple and enduring: preserve what
              is true, teach what you know, and serve those who need help.
              Those three commitments — preservation, education and service —
              continue to define the Foundation that bears his name.
            </p>
          </div>

          <div>
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-warm-cream to-[#E9DDD0] p-8 text-center">
                <div>
                  <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-burgundy">
                    <span className="font-bold text-burgundy">VGMF</span>
                  </div>
                  <p className="text-lg font-bold text-text-primary">
                    Vaidya R. B. Gogate
                  </p>
                  <p className="mt-2 text-sm text-text-muted">
                    Physician • Teacher • Scholar
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Continuing Legacy
              </h3>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                Each seminar we host, each student we train, each patient
                we treat and each book we publish continues the work that
                Vaidya R. B. Gogate began — carrying classical Ayurveda
                forward with the same integrity he practised throughout
                his life.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-warm-cream">
        <div className="container max-w-4xl">
          <h2 className="heading-3 mb-10 text-center">Timeline</h2>

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
                <h3 className="mt-1 text-xl font-semibold text-text-primary">
                  {item.title}
                </h3>
                <p className="mt-2 text-body">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}