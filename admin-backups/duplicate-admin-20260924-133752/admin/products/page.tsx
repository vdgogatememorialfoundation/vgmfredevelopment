import AdminModule from "@/components/admin/AdminModule";

export default function Page() {
  return (
    <AdminModule
      section="Commerce"
      title="Products"
      description="Manage products."
      action="Add Product"
      actionHref="/admin/products"
    />
  );
}
