import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Settings"
      title="Registration"
      description="Configure registration fields, OTP and approval."
      action={"undefined"}
      actionHref={undefined}
    />
  );
}
