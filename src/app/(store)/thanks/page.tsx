import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import ThanksSection from "@/components/home/ThanksSection";

export const metadata: Metadata = {
  title: "Special thanks",
  description: "People and organisations the Foundation wishes to thank.",
};

export default function ThanksPage() {
  return (
    <main>
      <PageHeader eyebrow="Credits" title="Special thanks" showDescription={false} />
      <ThanksSection />
    </main>
  );
}
