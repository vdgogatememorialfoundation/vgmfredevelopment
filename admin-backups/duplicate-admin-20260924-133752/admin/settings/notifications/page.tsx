import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="Notifications"
      description="Configure notifications."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
