"use client";

import RecordDesk from "@/components/admin/RecordDesk";
import { hideAward, saveAward } from "@/lib/cms";
import { publishLiveSite } from "@/lib/mobile-publish";
import { useLiveAwards } from "@/lib/use-cms";
import type { PrizeAward } from "@/types";

export default function Page() {
  const records = useLiveAwards();
  return (
    <RecordDesk<PrizeAward>
      heading="Competition awards"
      description="Add the person, the award, the competition, and the seminar it belongs to. The public page and the homepage group them by that seminar."
      publicHref="/awards"
      records={records}
      label={(record) => [record.personName, record.awardName].filter(Boolean).join(" · ") || "Award"}
      fields={[
        { key: "personName", label: "Person name" },
        { key: "awardName", label: "Award name" },
        { key: "competitionType", label: "Competition type" },
        { key: "category", label: "Seminar or category" },
        { key: "year", label: "Year" },
        { key: "image", label: "Award image", kind: "image" },
        { key: "note", label: "Note", kind: "textarea" },
      ]}
      blank={() => ({
        id: `award-${Date.now()}`,
        personName: "",
        awardName: "",
        competitionType: "",
        category: "",
        image: "",
        year: "",
        note: "",
      })}
      onSave={(record) => {
        saveAward(record);
        void publishLiveSite();
      }}
      onHide={(id) => {
        hideAward(id);
        void publishLiveSite();
      }}
    />
  );
}
