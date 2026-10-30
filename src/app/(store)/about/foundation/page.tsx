import type { Metadata } from "next";
import { FoundationLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Foundation",
  description:
    "Vaidya Gogate Memorial Foundation’s sole motto is Propagation of knowledge — sharing Vd. Ramchandra Ballal Gogate’s work and carrying forward his vision ‘knowledge for all’.",
};

export default function FoundationPage() {
  return <FoundationLive />;
}
