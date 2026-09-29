import Link from "next/link";
import ApplicationTracker from "@/components/applications/ApplicationTracker";

export const metadata = {
  title: "Application Status",
  description:
    "Track the status of your event application using your Application ID.",
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
            Enter the Application ID you received after registering for an
            event to check its current status.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          <ApplicationTracker initialApplicationId={applicationId} />
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-text-muted">
          Foundations event applications are managed on the{" "}
          <Link
            href="https://seminar.vaidyagogate.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-burgundy hover:underline"
          >
            official seminar website
          </Link>
          , where you can also track your Application ID. The tracker below
          is a demo utility.
        </p>
      </div>
    </main>
  );
}