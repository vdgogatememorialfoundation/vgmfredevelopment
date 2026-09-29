import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="WhatsApp"
      description="Configure WhatsApp templates and webhooks."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
