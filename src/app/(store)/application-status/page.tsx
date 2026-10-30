import ApplicationTracker from "@/components/applications/ApplicationTracker";

export const metadata = {
  title: "Application Status",
  description:
    "Track Seminar, Autism and Fellowship applications using your Application ID.",
};

export default async function ApplicationStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const { applicationId } = await searchParams;

  return (
    <main className="border-t border-border bg-background">
      <div className="container py-12 sm:py-16">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">
            Track Application
          </p>
          <h1 className="heading-2 mt-2">Application Status</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Enter the Application ID from your Seminar, Autism or Fellowship registration
            to follow the same submitted → review → approved → confirmed pipeline.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          <ApplicationTracker initialApplicationId={applicationId} />
        </div>
      </div>
    </main>
  );
}
