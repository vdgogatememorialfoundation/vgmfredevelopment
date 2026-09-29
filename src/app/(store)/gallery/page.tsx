import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import GalleryGrid from "@/components/pages/GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Moments from seminars, workshops, clinics and community programmes of the Vaidya Gogate Memorial Foundation.",
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Gallery"
        title="Moments from our work"
        description="Seminars, classrooms, clinics and community camps — a glimpse into the life of the Foundation."
        breadcrumb={[{ name: "Gallery", href: "/gallery" }]}
      />
      <section className="section bg-warm-cream">
        <div className="container">
          <GalleryGrid />
        </div>
      </section>
    </>
  );
}
