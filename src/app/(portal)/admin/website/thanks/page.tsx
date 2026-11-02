"use client";

import RecordDesk from "@/components/admin/RecordDesk";
import { hideThanks, saveThanks } from "@/lib/cms";
import { publishLiveSite } from "@/lib/mobile-publish";
import { useLiveThanks } from "@/lib/use-cms";
import type { ThanksCredit } from "@/types";

export default function Page() {
  const records = useLiveThanks();
  return (
    <RecordDesk<ThanksCredit>
      heading="Special thanks"
      description="Add a credit with an image, a title, and a description. Saving publishes it on the Special thanks page."
      publicHref="/thanks"
      records={records}
      label={(record) => record.title || "Credit"}
      fields={[
        { key: "title", label: "Title" },
        { key: "description", label: "Description", kind: "textarea" },
        { key: "image", label: "Image", kind: "image" },
      ]}
      blank={() => ({
        id: `thanks-${Date.now()}`,
        title: "",
        description: "",
        image: "",
      })}
      onSave={(record) => {
        saveThanks(record);
        void publishLiveSite();
      }}
      onHide={(id) => {
        hideThanks(id);
        void publishLiveSite();
      }}
    />
  );
}
