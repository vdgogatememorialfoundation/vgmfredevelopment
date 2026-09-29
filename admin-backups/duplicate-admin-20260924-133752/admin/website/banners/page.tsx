import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Banners"
      description="Manage website banners."
      action={"undefined"}
      actionHref={"/admin/website/banners"}
    />
  );
}
