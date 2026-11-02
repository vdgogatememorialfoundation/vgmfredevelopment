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
      description="Embed a video link, or upload a video file. It plays on the public videos page."
      publicHref="/videos"
      records={records}
      label={(record) => record.title}
      fields={[
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        {
          key: "kind",
          label: "Source",
          kind: "select",
          options: [
            { value: "youtube", label: "Embed a link" },
            { value: "upload", label: "Upload a video" },
          ],
        },
        {
          key: "youtubeUrl",
          label: "Video link",
          visible: (record) => record.kind !== "upload",
        },
        {
          key: "src",
          label: "Video file",
          kind: "file",
          accept: "video/*",
          visible: (record) => record.kind === "upload",
        },
        { key: "poster", label: "Poster", kind: "image" },
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
        src: "",
      })}
      onSave={(record) => {
        const embed = record.kind !== "upload";
        saveVideo({
          ...record,
          kind: embed ? "youtube" : "upload",
          youtubeUrl: embed ? (record.youtubeUrl || "").trim() : "",
          src: embed ? "" : record.src || "",
        });
      }}
      onHide={hideVideo}
    />
  );
}
