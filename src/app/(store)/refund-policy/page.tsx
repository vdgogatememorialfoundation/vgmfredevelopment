import type { Metadata } from "next";
import LegalPage from "@/components/common/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Refund policy for event registrations and book orders from the Vaidya Gogate Memorial Foundation.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Refund Policy"
      description="The refund policy for event registrations and book orders placed through the Vaidya Gogate Memorial Foundation website."
      lastUpdated="Sept 2026"
      sections={[
        {
          title: "Event Registrations",
          body: "Registration fees for events may be refunded minus an administrative charge if cancellation is requested at least 15 days before the event start date. No refund is available for cancellations within 15 days of the event. Requests must be submitted through your account or by contacting support.",
        },
        {
          title: "Books & Publications",
          body: "Books may be returned within 7 days of delivery if they are received damaged or with defects, or if a different book was shipped. Please contact us with your order number. Return shipping for our error is borne by the Foundation.",
        },
        {
          title: "Non-Refundable Items",
          body: "Downloadable or digital content, where provided, is non-refundable once delivered. Participation certificates once issued are non-refundable.",
        },
        {
          title: "How Refunds Are Processed",
          body: "Approved refunds are processed to the original payment method within 7-10 working days. While we use a recognised payment gateway (Razorpay) for transactions, the actual processing may take additional time depending on your bank.",
        },
      ]}
    />
  );
}