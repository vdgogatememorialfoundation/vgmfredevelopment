import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="Payments"
      description="Configure payment settings."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
