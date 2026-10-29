import type { Metadata } from "next";
import ContactPage from "@/components/store/ContactPage";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact the Vaidya Gogate Memorial Foundation by email, phone, or by visiting our office in Pune.",
};

export default function ContactRoute() {
  return <ContactPage />;
}
