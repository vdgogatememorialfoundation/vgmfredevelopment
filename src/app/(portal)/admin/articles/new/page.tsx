import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Articles"
      title="Create Article"
      description="Create a new article with title, description, content, images and SEO."
    />
  );
}
