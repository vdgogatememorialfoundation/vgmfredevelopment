import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import { SeminarVideoLibrary } from "@/components/videos/SeminarVideoLibrary";

export const metadata: Metadata = {
  title: "Seminar videos",
  description: "Watch Foundation seminar recordings. Free for volunteers and for people who paid for the seminar. Paid for anyone who did not register.",
};

export default function SeminarVideosPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Media"
        title="Seminar videos"
        description="These recordings stay free for volunteers and for everyone who paid for that seminar, whether they attended or not. If you did not register, you can buy the recording here."
        breadcrumb={[{ name: "Videos", href: "/videos" }, { name: "Seminar videos", href: "/videos/seminars" }]}
      />
      <section className="section bg-background">
        <div className="container">
          <SeminarVideoLibrary />
        </div>
      </section>
    </main>
  );
}
