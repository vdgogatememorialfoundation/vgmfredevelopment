import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Payments"
      title="Payment Gateway"
      description="Configure payment gateway providers."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
