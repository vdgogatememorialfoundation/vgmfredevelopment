import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";

export default function CardsPage() {
  return (
    <div>
      <SectionHeader
        title="My Saved Cards"
        description="Cards stored securely for faster checkouts."
      />
      <EmptyState
        title="No saved cards"
        description="Cards can be saved after a successful shop order. You can manage them here."
        cta={{ label: "Browse the Shop", href: "/shop" }}
      />
    </div>
  );
}