import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Delivery Partners"
      title="Shipments"
      description="View shipments assigned to delivery providers."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
