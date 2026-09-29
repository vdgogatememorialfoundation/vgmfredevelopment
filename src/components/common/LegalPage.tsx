import PageHeader from "@/components/common/PageHeader";

interface LegalSection {
  title: string;
  body: string;
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
  lastUpdated: string;
}

export default function LegalPage({
  eyebrow,
  title,
  description,
  sections,
  lastUpdated,
}: LegalPageProps) {
  return (
    <main>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <section className="section bg-background">
        <div className="container max-w-3xl">
          <p className="mb-10 text-sm text-text-muted">
            Last updated: {lastUpdated}
          </p>

          <div className="space-y-10">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="heading-3 mb-3">{section.title}</h2>
                <p className="text-body">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}