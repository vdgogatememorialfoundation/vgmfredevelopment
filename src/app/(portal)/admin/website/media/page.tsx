import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Media Library"
      description="Manage website images, PDFs and documents."
      action="Upload Media"
      actionHref="/admin/website/media"
    />
  );
}
