import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Accounts"
      title="Staff Accounts"
      description="Manage Foundation administrators and staff accounts."
      action="Create Staff"
      actionHref="/admin/accounts/staff"
    />
  );
}
