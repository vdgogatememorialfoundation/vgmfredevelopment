"use client";

import type { Application } from "@/types";
import { applicationPipelineSteps } from "@/lib/application-pipeline";
import { formatDate } from "@/lib/utils";
import VerticalPipeline, { type PipelineStageShape } from "@/components/tracking/VerticalPipeline";

export default function ApplicationPipeline({
  application,
  rawStatus,
}: {
  application: Application;
  rawStatus?: string;
}) {
  const statusIndex = applicationPipelineSteps.findIndex((step) => step.key === application.status);
  const rejected = application.status === "Rejected";

  const stages: PipelineStageShape[] = applicationPipelineSteps.map((step, index) => ({
    id: step.key,
    label: step.label,
    caption:
      index === 0
        ? `Applied on ${formatDate(application.appliedAt)}`
        : rawStatus && index === Math.max(0, statusIndex)
          ? rawStatus
          : "",
    reached: rejected ? index === 0 : statusIndex >= index,
    partial: !rejected && statusIndex === index && application.status !== "Confirmed",
    events:
      index === 0
        ? [
            {
              id: "applied",
              title: "Application received",
              at: application.appliedAt,
              reached: true,
              detail: application.name || undefined,
            },
          ]
        : statusIndex >= index
          ? [
              {
                id: step.key,
                title: rawStatus && index === statusIndex ? rawStatus : step.label,
                at: application.appliedAt,
                reached: true,
              },
            ]
          : [],
  }));

  if (rejected) {
    stages.push({
      id: "Rejected",
      label: "Rejected",
      caption: rawStatus || "This application was not approved",
      reached: true,
      partial: false,
      events: [
        {
          id: "rejected",
          title: rawStatus || "This application was not approved",
          at: application.appliedAt,
          reached: true,
          detail: "Please contact the Foundation for more information.",
        },
      ],
    });
  }

  const visible = rejected ? stages.filter((stage) => stage.reached) : stages;
  const currentIndex = rejected ? visible.length - 1 : Math.max(0, statusIndex);
  const live = rawStatus || application.status;
  const note = rejected
    ? "This application was not approved. The line stops here."
    : application.status === "Confirmed"
      ? `Live status: ${live}.`
      : `The line moves down to ${live}, and it stops before the next step.`;

  return (
    <VerticalPipeline
      stages={visible}
      currentIndex={currentIndex}
      failed={rejected}
      metaFor={(stage) => (stage.id === "Submitted" || stage.reached ? formatDate(application.appliedAt) : "")}
      note={note}
    />
  );
}
