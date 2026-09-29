import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";

const pillars = [
  {
    title: "Ayurveda",
    description:
      "Preserving and advancing classical Ayurveda knowledge and practice.",
  },
  {
    title: "Education",
    description:
      "Training the next generation of Ayurveda physicians and scholars.",
  },
  {
    title: "Research",
    description:
      "Strengthening evidence and scholarship for the science of Ayurveda.",
  },
];

export default function LegacySection() {
  return (
    <section className="section bg-warm-cream" aria-labelledby="legacy-heading">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Our Legacy"
              title="The Legacy of Vaidya R. B. Gogate"
              description="Vaidya R. B. Gogate devoted his life to the study, practice and teaching of Ayurveda. The Foundation built in his memory carries this work forward — through clinical care, education, research and publications."
            />

            <ul className="grid gap-4 sm:grid-cols-3" role="list">
              {pillars.map((pillar) => (
                <li
                  key={pillar.title}
                  className="rounded-2xl border border-border bg-white p-5"
                >
                  <p className="font-semibold text-burgundy">
                    {pillar.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    {pillar.description}
                  </p>
                </li>
              ))}
            </ul>

            <Link
              href="/about/legacy-of-vaidya-rb-gogate"
              className="btn-primary mt-8"
            >
              Discover Our Legacy
            </Link>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-warm-cream to-[#E9DDD0] p-8 text-center">
                <div>
                  <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-burgundy">
                    <span className="font-bold text-burgundy">
                      VGMF
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-text-primary">
                    Vaidya R. B. Gogate
                  </h2>
                  <p className="mt-2 text-sm text-text-muted">
                    Physician • Teacher • Scholar
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}