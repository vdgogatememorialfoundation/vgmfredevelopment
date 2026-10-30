"use client";

import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";
import ApplicationTracker from "@/components/applications/ApplicationTracker";

export default function ApplicationsPage() {
  const { user } = useAuth();

  return (
    <div>
      <SectionHeader
        title="Application Status"
        description="Live Seminar, Autism and Fellowship statuses on this portal. Seminar applications open the doctor portal at seminar.vaidyagogate.org/doctor."
      />
      <PartnerPortalBadges user={user} className="mb-5" />
      <ApplicationTracker />
    </div>
  );
}
