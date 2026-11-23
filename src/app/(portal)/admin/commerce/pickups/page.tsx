import { Suspense } from "react";
import AdminLogisticsOps from "@/components/admin/AdminLogisticsOps";
export default function PickupsPage() { return <Suspense fallback={<div className="p-6 text-sm">Loading...</div>}><AdminLogisticsOps only="pickup" /></Suspense>; }
