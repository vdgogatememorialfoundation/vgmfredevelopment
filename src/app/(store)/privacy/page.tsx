import type { Metadata } from "next";
import LegalPage from "@/components/common/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for the Vaidya Gogate Memorial Foundation website and services.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="This policy explains how the Vaidya Gogate Memorial Foundation collects, uses and protects your personal information when you use our website and services."
      lastUpdated="Sept 2026"
      sections={[
        {
          title: "Information We Collect",
          body: "When you create an account, we collect your first and last name, email address, phone number and WhatsApp number. When you register for events or place orders, we collect the information needed to fulfil those requests, including delivery addresses where applicable. We do not store payment card details on our servers; payments are processed by our payment gateway provider.",
        },
        {
          title: "How We Use Your Information",
          body: "We use your information to create and manage your account, issue a unique 12-digit Account ID, communicate about events, process registrations and orders, issue certificates and provide support. We may send you updates about events and publications when you opt in to receive them.",
        },
        {
          title: "Verification",
          body: "To create an account we verify your email address and WhatsApp number using one-time passwords. This helps us ensure that every Account ID is linked to a genuine, contactable user.",
        },
        {
          title: "Data Sharing",
          body: "We do not sell your personal information. We share data only with service providers that help us operate the website (such as the payment gateway, email and WhatsApp services, and file storage), and only to the extent needed to provide our services.",
        },
        {
          title: "Data Security",
          body: "We follow reasonable technical and organisational measures to protect your data, including encrypted transmission, restricted access and careful handling of secrets such as API keys in environment variables.",
        },
        {
          title: "Your Rights",
          body: "You may request a copy of the personal data we hold about you, ask for corrections, or request deletion of your account by contacting us at info@vaidyagogate.org.",
        },
      ]}
    />
  );
}