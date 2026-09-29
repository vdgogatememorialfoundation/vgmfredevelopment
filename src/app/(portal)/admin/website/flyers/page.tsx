import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Flyers"
      description="Manage promotional and event flyers."
      action="Add Flyer"
      actionHref="/admin/website/flyers"
    />
  );
}
