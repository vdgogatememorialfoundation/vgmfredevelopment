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
      description="Add images and posters here. They play in the homepage slideshow. Notices are not shown in the slideshow — publish those on the Notice board."
      publicHref="/"
      records={records}
      label={(record) => record.title}
      fields={[
        { key: "title", label: "Title" },
        { key: "event", label: "Event" },
        { key: "date", label: "Date" },
        { key: "cta", label: "Button label" },
        { key: "href", label: "Link" },
        { key: "image", label: "Banner image (wide, about 1600 × 700)", kind: "image" },
      ]}
      blank={() => ({
        id: `fly-${Date.now()}`,
        title: "",
        event: "",
        date: new Date().toISOString().slice(0, 10),
        image: "",
        href: "/events",
        cta: "View event",
        isDesktop: true,
        isMobile: true,
      })}
      onSave={(record) => saveFlyer({ ...record, href: record.href || "/events", cta: record.cta || "View event" })}
      onHide={hideFlyer}
    />
  );
}
