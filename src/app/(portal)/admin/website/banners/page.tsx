import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Banners"
      description="Manage website banners."
      action="Add Banner"
      actionHref="/admin/website/banners"
    />
  );
}
