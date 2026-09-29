import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";

export default function SubscriptionsPage() {
  return (
    <div>
      <SectionHeader
        title="Subscriptions"
        description="Manage your newsletter and content subscriptions with the Foundation."
      />
      <EmptyState
        title="No active subscriptions"
        description="Subscribe to the Foundation newsletter in the articles section to receive scholarly updates, event announcements and clinic news."
        cta={{ label: "Read Articles", href: "/articles" }}
      />
    </div>
  );
}