import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";

export const metadata: Metadata = {
  title: "Trustees & Team",
  description:
    "Meet the trustees, scholars and staff of the Vaidya Gogate Memorial Foundation.",
};

const trustees = [
  {
    name: "Dr. Ananya Deshpande",
    role: "Director & Trustee",
    bio: "Leads the Foundation's education, research and clinical programmes.",
  },
  {
    name: "Vaidya Sunil Khandekar",
    role: "Chief Physician",
    bio: "Directs the Panchakarma Centre and clinical training programmes.",
  },
  {
    name: "Dr. Meera Joshi",
    role: "Head of Education",
    bio: "Oversees the curriculum, seminars and continuing education programmes.",
  },
];

const staff = [
  { name: "Vaidya Prakash Vaidya", role: "Research Scholar" },
  { name: "Dr. Nitin Patil", role: "Research Associate" },
  { name: "Dr. Shalini Bhagat", role: "Consultant Physician" },
];

export default function TrusteesPage() {
  return (
    <main>
      <PageHeader
        eyebrow="About Us"
        title="Trustees & Team"
        description="The trustees, scholars and staff who guide the Foundation's work and carry forward the legacy of Vaidya R. B. Gogate."
        breadcrumb={[{ name: "About", href: "/about" }]}
      />

      <section className="section bg-background">
        <div className="container">
          <h2 className="heading-3 mb-8">Trustees</h2>

          <div className="grid gap-6 md:grid-cols-3">
            {trustees.map((person) => (
              <div key={person.name} className="card p-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-burgundy/20 bg-burgundy/5">
                  <span className="text-sm font-bold text-burgundy">
                    {person.name
                      .split(" ")
                      .slice(-2)
                      .map((word) => word[0])
                      .join("")}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-semibold text-text-primary">
                  {person.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-burgundy">
                  {person.role}
                </p>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  {person.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-warm-cream">
        <div className="container">
          <h2 className="heading-3 mb-8">Our Team</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((person) => (
              <div
                key={person.name}
                className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-burgundy/20 bg-burgundy/5">
                  <span className="text-xs font-bold text-burgundy">
                    {person.name
                      .split(" ")
                      .slice(-2)
                      .map((word) => word[0])
                      .join("")}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{person.name}</p>
                  <p className="text-sm text-text-muted">{person.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}