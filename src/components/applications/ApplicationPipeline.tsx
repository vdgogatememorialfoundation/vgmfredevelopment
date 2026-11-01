"use client";

import type { Application, PartnerPortalId } from "@/types";
import {
  isTerminalPartnerStatus,
  pipelineIndexFor,
  pipelineStepsFor,
  prettyPartnerStatus,
  type PartnerStatusCatalog,
} from "@/lib/application-pipeline";
import { formatDate } from "@/lib/utils";
import VerticalPipeline, { type PipelineStageShape } from "@/components/tracking/VerticalPipeline";

export default function ApplicationPipeline({
  application,
  rawStatus,
  portal,
  catalog,
}: {
  application: Application;
  rawStatus?: string;
  portal?: PartnerPortalId;
  catalog?: Partial<PartnerStatusCatalog>;
}) {
  const live = prettyPartnerStatus(rawStatus) || application.status;
  const steps = pipelineStepsFor(portal, catalog, rawStatus || application.status);
  const statusIndex = pipelineIndexFor(steps, rawStatus, application.status);
  const rejected = isTerminalPartnerStatus(rawStatus) || application.status === "Rejected";
  const lastHappy = rejected ? 0 : statusIndex;

  const stages: PipelineStageShape[] = steps.map((step, index) => {
    const current = index === statusIndex;
    const reached = rejected ? index === 0 || current : lastHappy >= index;
    return {
      id: step.key,
      label: step.label,
      caption:
        index === 0
          ? `Applied on ${formatDate(application.appliedAt)}`
          : current
            ? live
            : "",
      reached,
      partial: !rejected && current && index < steps.length - 1,
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
          : reached
            ? [
                {
                  id: step.key,
                  title: current ? live : step.label,
                  at: application.appliedAt,
                  reached: true,
                },
              ]
            : [],
    };
  });

  const visible = rejected ? stages.filter((stage) => stage.reached) : stages;
  const currentIndex = rejected ? visible.length - 1 : Math.max(0, statusIndex);
  const note = rejected
    ? `This application is ${live}. The line stops here.`
    : statusIndex >= steps.length - 1
      ? `Live status: ${live}.`
      : `The line moves down to ${live}, and it stops before the next step.`;

  return (
    <VerticalPipeline
      stages={visible}
      currentIndex={currentIndex}
      failed={rejected}
      metaFor={(stage) => (stage.id === steps[0]?.key || stage.reached ? formatDate(application.appliedAt) : "")}
      note={note}
    />
  );
}
