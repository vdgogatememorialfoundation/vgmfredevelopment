import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Media Library"
      description="Manage images, PDFs and website media."
      action={"undefined"}
      actionHref={"/admin/website/media"}
    />
  );
}
