import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Videos"
      description="Manage Foundation video content."
      action={"undefined"}
      actionHref={"/admin/website/videos"}
    />
  );
}
