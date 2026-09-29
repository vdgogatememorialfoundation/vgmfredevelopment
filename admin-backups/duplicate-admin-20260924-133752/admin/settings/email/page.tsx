import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="Email"
      description="Configure email settings."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
