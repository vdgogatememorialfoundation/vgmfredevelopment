import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="Orders"
      description="Configure order processing."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
