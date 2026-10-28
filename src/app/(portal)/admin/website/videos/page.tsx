"use client";

import RecordDesk from "@/components/admin/RecordDesk";
import { hideVideo, saveVideo } from "@/lib/cms";
import { useLiveVideos } from "@/lib/use-cms";
import type { Video } from "@/types";

export default function Page() {
  const records = useLiveVideos();
  return (
    <RecordDesk<Video>
      heading="Videos"
      description="Videos saved here appear on the public videos page."
      publicHref="/videos"
      records={records}
      label={(record) => record.title}
      fields={[
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "youtubeUrl", label: "YouTube link" },
        { key: "description", label: "Description", kind: "textarea" },
        { key: "date", label: "Date" },
      ]}
      blank={() => ({
        id: `vid-${Date.now()}`,
        title: "",
        description: "",
        date: new Date().toISOString().slice(0, 10),
        category: "Foundation",
        kind: "youtube",
        youtubeUrl: "",
      })}
      onSave={(record) => saveVideo({ ...record, kind: "youtube", youtubeUrl: record.youtubeUrl || "" })}
      onHide={hideVideo}
    />
  );
}
