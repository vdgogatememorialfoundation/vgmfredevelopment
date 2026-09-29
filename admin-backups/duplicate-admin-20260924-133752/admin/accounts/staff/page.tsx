import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Accounts"
      title="Staff Accounts"
      description="Manage administrators and Foundation staff accounts."
      action={"undefined"}
      actionHref={"/admin/accounts/staff"}
    />
  );
}
