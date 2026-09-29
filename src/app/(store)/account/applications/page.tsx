import Link from "next/link";
import SectionHeader from "@/components/account/SectionHeader";
import { seminarSiteUrl } from "@/lib/constants";

export const metadata = {
  title: "View Application Status",
  description:
    "Track the status of your seminar and event applications on the official seminar website.",
};

export default function ApplicationsPage() {
  return (
    <div>
      <SectionHeader
        title="View Application Status"
        description="Applications for Foundation events are processed on the official seminar website."
      />
      <div className="rounded-2xl border border-burgundy/20 bg-burgundy/5 p-8 text-center">
        <p className="text-sm text-text-muted">
          Track your Application ID and registration status on the
          official seminar website.
        </p>
        <Link
          href={seminarSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-6"
        >
          Track on Seminar Website
        </Link>
      </div>
    </div>
  );
}