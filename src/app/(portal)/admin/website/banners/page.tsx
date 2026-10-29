"use client";

import RecordDesk from "@/components/admin/RecordDesk";
import { hideBanner, saveBanner } from "@/lib/cms";
import { useLiveBanners } from "@/lib/use-cms";
import type { SiteBanner } from "@/types";

export default function Page() {
  const records = useLiveBanners();
  return (
    <RecordDesk<SiteBanner>
      heading="Site banners"
      description="Banners appear as a popup on the public site. Add an image only, or an image with a link. They are not part of the homepage slideshow."
      publicHref="/"
      records={records}
      label={(record) => record.title || (record.href ? `Link · ${record.href}` : "Banner")}
      fields={[
        { key: "image", label: "Banner image", kind: "image" },
        { key: "title", label: "Title (shown under the image, optional)" },
        { key: "href", label: "Optional link" },
      ]}
      blank={() => ({
        id: `ban-${Date.now()}`,
        title: "",
        image: "",
        href: "",
      })}
      onSave={(record) => saveBanner({ ...record, href: record.href.trim() })}
      onHide={hideBanner}
    />
  );
}
