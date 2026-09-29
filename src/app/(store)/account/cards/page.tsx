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
        description="Cards are saved securely through our payment gateway after a successful checkout. You can manage them here."
        cta={{ label: "Go to Checkout", href: "/checkout" }}
      />
    </div>
  );
}