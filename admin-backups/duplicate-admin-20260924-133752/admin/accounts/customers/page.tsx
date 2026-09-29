import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Accounts"
      title="Customers"
      description="Manage customer profiles, account IDs and user activity."
      action={"undefined"}
      actionHref={"/admin/accounts/customers"}
    />
  );
}
