import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Commerce"
      title="Shipments"
      description="Manage shipments and fulfilment."
      action="Create Shipment"
      actionHref="/admin/shipments/create"
    />
  );
}
