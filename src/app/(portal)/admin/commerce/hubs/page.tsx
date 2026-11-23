import { Suspense } from "react";
import AdminHubDashboard from "@/components/admin/AdminHubDashboard";
export default function HubOperationsPage() { return <Suspense fallback={<div className="p-6 text-sm">Loading Hub Operations...</div>}><AdminHubDashboard /></Suspense>; }
