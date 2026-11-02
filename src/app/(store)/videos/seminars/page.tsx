import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import { SeminarVideoLibrary } from "@/components/videos/SeminarVideoLibrary";

export const metadata: Metadata = {
  title: "Seminar videos",
};

export default function SeminarVideosPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Media"
        title="Seminar videos"
        showDescription={false}
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
