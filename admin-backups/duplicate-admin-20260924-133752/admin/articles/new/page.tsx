import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Articles"
      title="Create Article"
      description="Create a new article with content, images, author and SEO information."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
