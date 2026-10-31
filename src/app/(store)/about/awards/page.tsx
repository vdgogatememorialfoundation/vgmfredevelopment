import type { Metadata } from "next";
import { AwardsLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Awards & Accolades",
  description:
    "Vd. R. B. Gogate’s awards include the Pandit Ramnarayan Sharma Award received at the hands of the President of India, Sushrut Puraskar, Gayatri Pratishthan Puraskar, Legend Shalaki Karyabhushan Puraskar and Jivan Gaurav Puraskar.",
};

export default function AwardsPage() {
  return <AwardsLive />;
}
