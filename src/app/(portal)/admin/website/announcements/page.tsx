import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Website & CMS"
      title="Announcements"
      description="Create and publish Foundation announcements."
      action="Add Announcement"
      actionHref="/admin/website/announcements"
    />
  );
}
