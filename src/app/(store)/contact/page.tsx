import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import { siteConfig } from "@/lib/constants";
import ContactForm from "@/components/store/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact the Vaidya Gogate Memorial Foundation — by email, phone, WhatsApp or by visiting our office in Pune.",
};

export default function ContactPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Contact"
        title="Get in Touch"
        description="Reach the Foundation by phone, email, WhatsApp or by visiting our office. We welcome enquiries about events, publications, clinics and the Foundation's programmes."
      />

      <section className="section bg-background">
        <div className="container grid gap-10 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Address
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-primary">
                {siteConfig.address}
              </p>
            </div>

            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Email
              </h2>
              <a
                href={`mailto:${siteConfig.email}`}
                className="mt-3 inline-block text-sm font-medium text-burgundy hover:underline"
              >
                {siteConfig.email}
              </a>
            </div>

            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                Phone
              </h2>
              <a
                href={`tel:${siteConfig.phone}`}
                className="mt-3 inline-block text-sm font-medium text-burgundy hover:underline"
              >
                {siteConfig.phone}
              </a>
            </div>

            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                WhatsApp
              </h2>
              <a
                href={`https://wa.me/${siteConfig.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-burgundy hover:underline"
              >
                {siteConfig.whatsapp}
              </a>
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </main>
  );
}