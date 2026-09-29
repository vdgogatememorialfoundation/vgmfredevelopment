import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Articles"
      description="Create, edit and publish Foundation articles."
      action={"undefined"}
      actionHref={"/admin/articles/new"}
    />
  );
}
