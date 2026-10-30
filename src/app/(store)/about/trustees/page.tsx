import type { Metadata } from "next";
import { TrusteesLive } from "@/components/about/LiveAbout";

export const metadata: Metadata = {
  title: "Trustees & Team",
  description:
    "The grandchildren of Vd. R. B. Gogate are creating this platform on behalf of the Gogate family. Suggestions, guidelines and support are welcome.",
};

export default function TrusteesPage() {
  return <TrusteesLive />;
}
