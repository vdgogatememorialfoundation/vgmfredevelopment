import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="Shipping"
      description="Configure shipping providers and serviceability."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
