import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";

export const metadata: Metadata = {
  title: "Foundation",
  description:
    "The mission, vision and objectives of the Vaidya Gogate Memorial Foundation.",
};

export default function FoundationPage() {
  return (
    <main>
      <PageHeader
        eyebrow="About Us"
        title="About the Foundation"
        description="The Vaidya Gogate Memorial Foundation was established to preserve and advance the classical knowledge of Ayurveda for the benefit of present and future generations."
        breadcrumb={[{ name: "About", href: "/about" }]}
      />

      <section className="section bg-background">
        <div className="container grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="heading-3 mb-4">Mission</h2>
            <p className="text-body">
              To preserve the classical traditions of Ayurveda, advance
              knowledge through rigorous education and research, and
              serve society through accessible clinical and community
              programmes — guided always by the example of Vaidya R. B.
              Gogate.
            </p>

            <h2 className="heading-3 mb-4 mt-10">Vision</h2>
            <p className="text-body">
              A future in which Ayurveda is practiced, taught and
              researched with integrity, where every student has access
              to genuine scholarship, and where the benefits of classical
              knowledge are available to all who seek them.
            </p>

            <h2 className="heading-3 mb-4 mt-10">Objectives</h2>
            <ul className="space-y-3 text-body" role="list">
              {[
                "Provide education and training in classical Ayurveda",
                "Support research with sound methodology and ethical practice",
                "Publish authoritative clinical and scholarly works",
                "Operate clinics offering authentic consultation and therapy",
                "Organise seminars, workshops and public education programmes",
                "Preserve the archives, writings and legacy of Vaidya R. B. Gogate",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 text-burgundy">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="heading-3 mb-4">Activities</h2>
            <ul className="space-y-4" role="list">
              {[
                {
                  title: "Clinical Practice",
                  description:
                    "Foundation clinics offering general Ayurveda consultation, Panchakarma therapy and community health programmes.",
                  href: "/clinics",
                },
                {
                  title: "Education & Training",
                  description:
                    "Seminars, workshops, fellowship programmes and continuing education for physicians and students.",
                  href: "/events",
                },
                {
                  title: "Research & Scholarship",
                  description:
                    "Research methodology training, clinical studies and scholarly publications.",
                  href: "/articles",
                },
                {
                  title: "Publications",
                  description:
                    "Clinical references, biographies and scholarly works available through our online store.",
                  href: "/shop",
                },
              ].map((activity) => (
                <li key={activity.title} className="card p-6">
                  <Link
                    href={activity.href}
                    className="font-semibold text-text-primary transition hover:text-burgundy"
                  >
                    {activity.title}
                  </Link>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    {activity.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}