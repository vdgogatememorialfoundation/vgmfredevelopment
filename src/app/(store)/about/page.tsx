import type { Metadata } from "next";
import { AboutLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about the Vaidya Gogate Memorial Foundation — our mission, history, trustees and the enduring legacy of Vaidya R. B. Gogate.",
};

export default function AboutPage() {
  return <AboutLive />;
}
