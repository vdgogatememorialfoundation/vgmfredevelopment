import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Commerce"
      title="Orders"
      description="Manage Foundation ecommerce orders."
      action="Create Order"
      actionHref="/admin/shipments/orders/create"
    />
  );
}
