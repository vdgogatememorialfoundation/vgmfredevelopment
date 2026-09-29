import type { Metadata } from "next";
import { Building2, FileCheck2, HandCoins, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import DynamicIcon from "@/components/common/DynamicIcon";
import Reveal from "@/components/common/Reveal";
import DonateForm from "@/components/pages/DonateForm";
import { donationCauses } from "@/data/site";
import { siteConfig } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Support Us",
  description:
    "Support scholarships, research, free community health camps and the preservation of classical Ayurveda texts.",
};

const assurances = [
  { icon: ShieldCheck, title: "Transparent use", description: "Annual reports detail how every contribution is used." },
  { icon: FileCheck2, title: "Tax benefits", description: "Receipts include exemption details where applicable." },
  { icon: HandCoins, title: "Direct impact", description: "Funds go straight to programmes you choose." },
];

export default function DonatePage() {
  return (
    <>
      <PageHeader
        eyebrow="Support us"
        title="Invest in the future of Ayurveda"
        description="Your generosity sustains scholarships, research, clinics and community health camps across Maharashtra."
        breadcrumb={[{ name: "Support Us", href: "/donate" }]}
      />

      <section className="section bg-warm-cream">
        <div className="container grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-8">
            <Reveal>
              <h2 className="heading-2">Where your contribution goes</h2>
              <p className="mt-4 text-text-muted">
                The Foundation is sustained by physicians, alumni, patients and well-wishers who share a belief
                in authentic, evidence-informed Ayurveda.
              </p>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {donationCauses.map((cause, index) => (
                <Reveal key={cause.title} delay={index * 80} className="card p-6">
                  <span className="icon-tile h-12 w-12">
                    <DynamicIcon name={cause.icon} size={22} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{cause.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-text-muted">{cause.description}</p>
                </Reveal>
              ))}
            </div>
            <ul className="space-y-4">
              {assurances.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-light text-sage">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-text-muted">{description}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-dashed border-gold/60 bg-white p-6">
              <p className="flex items-center gap-2 font-semibold">
                <Building2 size={18} className="text-gold" /> Bank transfer & CSR partnerships
              </p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                For bank transfers, cheques or CSR collaborations, write to{" "}
                <a href={`mailto:${siteConfig.email}`} className="font-semibold text-burgundy hover:underline">
                  {siteConfig.email}
                </a>{" "}
                or call {siteConfig.phone}.
              </p>
            </div>
          </div>

          <div className="lg:sticky lg:top-28">
            <DonateForm />
          </div>
        </div>
      </section>
    </>
  );
}
