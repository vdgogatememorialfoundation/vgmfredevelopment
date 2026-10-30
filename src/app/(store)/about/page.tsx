import type { Metadata } from "next";
import { AboutLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Vaidya Gogate Memorial Foundation is a website with a sole motto: Propagation of knowledge. A platform to share Vd. Ramchandra Ballal Gogate’s work and carry forward his vision ‘knowledge for all’.",
};

export default function AboutPage() {
  return <AboutLive />;
}
