import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Shipments"
      title="Shipments"
      description="Manage shipments."
      action="Create Shipment"
      actionHref="/admin/shipments/create"
    />
  );
}
