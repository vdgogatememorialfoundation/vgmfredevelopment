import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Accounts"
      title="Customers"
      description="Manage customer accounts, profiles and 12-digit account IDs."
      action="Create Customer"
      actionHref="/admin/accounts/customers"
    />
  );
}
