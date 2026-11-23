import { Suspense } from "react";
import AdminLogisticsSettings from "@/components/admin/AdminLogisticsSettings";
export default function LogisticsSettingsPage() {
  return (
    <Suspense fallback={null}>
      <AdminLogisticsSettings />
    </Suspense>
  );
}
