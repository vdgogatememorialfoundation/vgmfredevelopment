import AdminLogisticsOps from "@/components/admin/AdminLogisticsOps";

export const metadata = { title: "Pickups" };

export default function PickupsPage() {
  return <AdminLogisticsOps only="pickup" />;
}
