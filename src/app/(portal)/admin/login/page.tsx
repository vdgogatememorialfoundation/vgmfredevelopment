import { Suspense } from "react";
import PortalSignIn from "@/components/portal/PortalSignIn";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <PortalSignIn portal="admin" />
    </Suspense>
  );
}
