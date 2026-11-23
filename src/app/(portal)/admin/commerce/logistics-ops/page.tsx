import { Suspense } from "react";
import AdminLogisticsOps from "@/components/admin/AdminLogisticsOps";
export default function LogisticsOpsPage() { return <Suspense fallback={<div className="p-6 text-sm">Loading...</div>}><AdminLogisticsOps /></Suspense>; }
