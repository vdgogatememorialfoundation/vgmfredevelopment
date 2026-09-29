import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="Events"
      description="Configure event settings."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
