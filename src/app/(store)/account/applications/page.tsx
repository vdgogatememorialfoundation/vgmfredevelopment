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
        description="Track Seminar, Autism and Fellowship applications on this portal. Seminar tracking opens seminar.vaidyagogate.org/doctor."
      />
      <PartnerPortalBadges user={user} className="mb-5" />
      <ApplicationTracker />
    </div>
  );
}
