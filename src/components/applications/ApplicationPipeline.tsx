import type { Application } from "@/types";
import { applicationPipelineSteps } from "@/lib/application-pipeline";
import { formatDate } from "@/lib/utils";

export default function ApplicationPipeline({
  application,
}: {
  application: Application;
}) {
  const statusIndex = applicationPipelineSteps.findIndex((step) => step.key === application.status);

  if (application.status === "Rejected") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        This application was not approved. Please contact the Foundation for more information.
      </div>
    );
  }

  return (
    <ol className="space-y-0" role="list">
      {applicationPipelineSteps.map((step, index) => {
        const reached = statusIndex >= index;
        const isLast = index === applicationPipelineSteps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute left-[11px] top-7 h-full w-0.5 ${
                  statusIndex > index ? "bg-burgundy" : "bg-border"
                }`}
              />
            )}
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                reached ? "border-burgundy bg-burgundy text-white" : "border-border bg-white text-text-muted"
              }`}
            >
              {reached ? "✓" : index + 1}
            </span>
            <div>
              <p className={`text-sm font-semibold ${reached ? "text-text-primary" : "text-text-muted"}`}>
                {step.label}
              </p>
              {index === 0 && (
                <p className="mt-1 text-xs text-text-muted">
                  Applied on {formatDate(application.appliedAt)}
                  {application.name ? ` · ${application.name}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
