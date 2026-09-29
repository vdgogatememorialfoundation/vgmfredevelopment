import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";

export default function ReceiptsPage() {
  return (
    <div>
      <SectionHeader
        title="Payment Receipts"
        description="Download a tax receipt or payment acknowledgement for any payment made to the Foundation."
      />
      <EmptyState
        title="No receipts yet"
        description="Once you make a payment for an event or order, a receipt will be available to download here."
        cta={{ label: "My Payments", href: "/account/payments" }}
      />
    </div>
  );
}