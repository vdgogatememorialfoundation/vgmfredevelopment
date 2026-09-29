import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Events"
      title="All Events"
      description="Manage seminars, workshops, fellowships and Foundation events."
      action={"undefined"}
      actionHref={"/admin/events/create"}
    />
  );
}
