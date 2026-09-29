import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";

export default function AccountFaqPage() {
  return (
    <div>
      <SectionHeader
        title="FAQ"
        description="Answers to common questions about your account, registrations, payments and certificates."
      />
      <EmptyState
        title="Still have questions?"
        description="Browse the Frequently Asked Questions page for detailed answers about events, registrations, the shop and more."
        cta={{ label: "Visit FAQ", href: "/faq" }}
      />
    </div>
  );
}