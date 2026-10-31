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
        description="Add a shipping address from the cart when you place a shop order."
        cta={{ label: "Browse the Shop", href: "/shop" }}
      />
    </div>
  );
}