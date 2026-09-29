import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import FaqBrowser from "@/components/pages/FaqBrowser";
import { getFaqCategories } from "@/lib/server/content";
import { siteConfig } from "@/lib/constants";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about events, certificates, clinics, orders and supporting the Foundation.",
};

export default async function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="Help centre"
        title="Frequently asked questions"
        description="Everything you need to know about events, certificates, clinics, publications and donations."
        breadcrumb={[{ name: "FAQ", href: "/faq" }]}
      />
      <section className="section bg-warm-cream">
        <div className="container">
          <FaqBrowser faqCategories={await getFaqCategories()} />
          <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl bg-saffron p-8 text-white sm:flex-row sm:p-10">
            <div>
              <h2 className="font-display text-2xl font-semibold">Didn&apos;t find your answer?</h2>
              <p className="mt-1 text-white/90">Write to us and we&apos;ll respond within one working day.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="btn-secondary">
                <MessageCircle size={16} /> Contact us
              </Link>
              <a href={`mailto:${siteConfig.email}`} className="btn-ghost-light">
                <Mail size={16} /> Email
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
