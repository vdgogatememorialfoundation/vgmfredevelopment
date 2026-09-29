import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Events"
      title="Create Event"
      description="Create an event with date, venue, fee, capacity and registration settings."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
