import { Suspense } from "react";
import PortalSignIn from "@/components/portal/PortalSignIn";

export default function StaffLoginPage() {
  return (
    <Suspense>
      <PortalSignIn portal="staff" />
    </Suspense>
  );
}
