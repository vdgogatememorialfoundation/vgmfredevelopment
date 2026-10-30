"use client";

import RecordDesk from "@/components/admin/RecordDesk";
import { hideFlyer, saveFlyer } from "@/lib/cms";
import { publishLiveSite } from "@/lib/mobile-publish";
import { useLiveFlyers } from "@/lib/use-cms";
import type { Flyer } from "@/types";

export default function Page() {
  const records = useLiveFlyers();
  return (
    <RecordDesk<Flyer>
      heading="Slideshow, images and posters"
      description="Add wide photos or posters here. They play in the compact homepage slideshow on phones and desktops after save. Images are shrunk automatically so they can be stored. Notices are not shown in the slideshow."
      publicHref="/"
      records={records}
      label={(record) => record.title || "Untitled slide"}
      fields={[
        { key: "image", label: "Slideshow image (wide photo or poster)", kind: "image" },
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
      imageMaxWidth={520}
      onSave={(record) => {
        saveFlyer({ ...record, href: record.href.trim(), cta: record.cta || "View" });
        void publishLiveSite();
      }}
      onHide={(id) => {
        hideFlyer(id);
        void publishLiveSite();
      }}
    />
  );
}
