import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Events"
      title="Create Event"
      description="Create an event with dates, venue, fees, capacity and registration settings."
    />
  );
}
