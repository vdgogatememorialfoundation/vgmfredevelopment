import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Flyers"
      description="Manage event and promotional flyers."
      action={"undefined"}
      actionHref={"/admin/website/flyers"}
    />
  );
}
