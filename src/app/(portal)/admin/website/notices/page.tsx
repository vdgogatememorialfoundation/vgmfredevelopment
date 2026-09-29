import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Notice Board"
      description="Manage official notices."
      action="Add Notice"
      actionHref="/admin/website/notices"
    />
  );
}
