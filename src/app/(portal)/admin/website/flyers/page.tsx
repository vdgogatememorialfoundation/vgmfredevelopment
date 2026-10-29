"use client";

import RecordDesk from "@/components/admin/RecordDesk";
import { hideFlyer, saveFlyer } from "@/lib/cms";
import { useLiveFlyers } from "@/lib/use-cms";
import type { Flyer } from "@/types";

export default function Page() {
  const records = useLiveFlyers();
  return (
    <RecordDesk<Flyer>
      heading="Slideshow, images and posters"
      description="Add images and posters here. They play in the homepage slideshow. Notices are not shown in the slideshow — publish those on the Notice board. Banners that should pop up on the site belong under Banners."
      publicHref="/"
      records={records}
      label={(record) => record.title || "Untitled slide"}
      fields={[
        { key: "image", label: "Slideshow image (wide, about 1600 × 700)", kind: "image" },
        { key: "title", label: "Title (admin label)" },
        { key: "href", label: "Optional link when the slide is clicked" },
      ]}
      blank={() => ({
        id: `fly-${Date.now()}`,
        title: "",
        event: "",
        date: new Date().toISOString().slice(0, 10),
        image: "",
        href: "",
        cta: "",
        isDesktop: true,
        isMobile: true,
      })}
      onSave={(record) => saveFlyer({ ...record, href: record.href.trim(), cta: record.cta || "View" })}
      onHide={hideFlyer}
    />
  );
}
