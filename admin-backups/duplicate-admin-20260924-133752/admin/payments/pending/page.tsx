import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Payments"
      title="Pending Payments"
      description="Review pending payments."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
