import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";

export default function WishlistPage() {
  return (
    <div>
      <SectionHeader
        title="My Wishlist"
        description="Publications you have saved for later."
      />
      <EmptyState
        title="Your wishlist is empty"
        description="Browse the shop and save publications you are interested in so you can find them easily later."
        cta={{ label: "Browse the Shop", href: "/shop" }}
      />
    </div>
  );
}