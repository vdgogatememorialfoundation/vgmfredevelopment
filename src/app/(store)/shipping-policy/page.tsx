import type { Metadata } from "next";
import LegalPage from "@/components/common/LegalPage";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Shipping policy for book orders from the Vaidya Gogate Memorial Foundation.",
};

export default function ShippingPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Shipping Policy"
      description="Shipping policy for orders placed through the Vaidya Gogate Memorial Foundation online store."
      lastUpdated="Sept 2026"
      sections={[
        {
          title: "Dispatch",
          body: "Orders are dispatched within 2-4 working days of payment confirmation. You will receive an email with your order number and tracking details once your order ships.",
        },
        {
          title: "Delivery Timelines",
          body: "Delivery typically takes 3-7 working days within Maharashtra and 5-12 working days elsewhere in India, depending on your location. International delivery is currently available on request.",
        },
        {
          title: "Shipping Charges",
          body: "Shipping is calculated at checkout based on the weight of your order and the delivery address. Orders above a stated threshold are eligible for free shipping where indicated.",
        },
        {
          title: "Order Tracking",
          body: "Track your order from the Orders section of your account using the provided tracking ID, or contact support with your order number.",
        },
        {
          title: "Damaged or Lost Parcels",
          body: "If your parcel arrives damaged or fails to arrive within 15 working days, please contact us and we will arrange a replacement or refund.",
        },
      ]}
    />
  );
}