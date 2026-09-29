import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="General Settings"
      description="Configure general Foundation settings."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
