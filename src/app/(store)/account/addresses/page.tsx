import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";

export default function AddressesPage() {
  return (
    <div>
      <SectionHeader
        title="Addresses"
        description="Manage the addresses used for shipping shop orders."
      />
      <EmptyState
        title="No saved addresses"
        description="Add a shipping address for faster checkouts and to track your orders."
        cta={{ label: "Go to Checkout", href: "/checkout" }}
      />
    </div>
  );
}