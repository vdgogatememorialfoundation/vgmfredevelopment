import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Payments"
      title="Failed Payments"
      description="Review failed payment transactions."
    />
  );
}
