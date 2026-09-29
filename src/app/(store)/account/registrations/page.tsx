"use client";

import Link from "next/link";
import SectionHeader from "@/components/account/SectionHeader";
import { seminarSiteUrl } from "@/lib/constants";

export default function RegistrationsPage() {
  return (
    <div>
      <SectionHeader
        title="My Event Registrations"
        description="Seminar and event registrations are handled on the official seminar website, where you can also track your applications."
      />
      <div className="rounded-2xl border border-burgundy/20 bg-burgundy/5 p-8 text-center">
        <p className="text-sm text-text-muted">
          To register for a Foundation event or check your Application
          status, visit the official seminar website.
        </p>
        <Link
          href={seminarSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-6"
        >
          Go to Seminar Website
        </Link>
      </div>
    </div>
  );
}