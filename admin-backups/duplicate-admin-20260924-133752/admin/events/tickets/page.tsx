import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Events"
      title="Tickets"
      description="Manage event tickets and QR codes."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
