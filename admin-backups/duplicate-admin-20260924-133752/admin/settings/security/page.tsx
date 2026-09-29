import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="Security"
      description="Configure administrator security."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
