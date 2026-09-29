import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import Accordion from "@/components/common/Accordion";
import SectionHeading from "@/components/common/SectionHeading";
import Reveal from "@/components/common/Reveal";
import { homeFaqs } from "@/data/site";

export default function FaqSection() {
  return (
    <section className="section bg-white" aria-labelledby="faq-heading">
      <div className="container grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionHeading
            id="faq-heading"
            align="left"
            eyebrow="Help centre"
            title="Frequently asked questions"
            description="Quick answers about events, certificates, clinics, orders and supporting the Foundation."
          />
          <Reveal className="rounded-3xl border border-border bg-warm-cream p-7">
            <span className="icon-tile h-12 w-12">
              <MessageCircle size={22} />
            </span>
            <h3 className="mt-5 font-display text-xl font-semibold text-text-primary">Still have questions?</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Our team typically responds within one working day.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/contact" className="btn-primary px-5 py-2.5 text-sm">
                Contact us
              </Link>
              <Link href="/faq" className="btn-outline px-5 py-2.5 text-sm">
                All FAQs <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
        <Reveal delay={100}>
          <Accordion items={homeFaqs} />
        </Reveal>
      </div>
    </section>
  );
}
