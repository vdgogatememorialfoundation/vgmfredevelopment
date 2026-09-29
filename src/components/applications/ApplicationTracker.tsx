"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/common/Badge";
import { getApplication } from "@/lib/applications";
import type { Application } from "@/types";
import { formatDate } from "@/lib/utils";

const steps: { key: Application["status"]; label: string }[] = [
  { key: "Submitted", label: "Submitted" },
  { key: "Under Review", label: "Under Review" },
  { key: "Approved", label: "Approved" },
  { key: "Confirmed", label: "Confirmed" },
];

export default function ApplicationTracker({
  initialApplicationId,
}: {
  initialApplicationId?: string;
}) {
  const [applicationId, setApplicationId] = useState(initialApplicationId ?? "");
  const [application, setApplication] = useState<Application | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (initialApplicationId) {
      handleSearch(initialApplicationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(id: string) {
    const trimmed = id.trim();
    const result = getApplication(trimmed);

    if (result) {
      setApplication(result);
      setNotFound(false);
    } else {
      setApplication(null);
      setNotFound(true);
    }
    setSearched(true);
  }

  const statusIndex = application
    ? steps.findIndex((step) => step.key === application.status)
    : -1;

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch(applicationId);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="application-id" className="sr-only">
          Application ID
        </label>
        <input
          id="application-id"
          type="text"
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
          className="input-field flex-1 font-mono tracking-[0.06em]"
          placeholder="e.g. VGMF-2026-104203"
        />
        <button type="submit" className="btn-primary">
          Track Status
        </button>
      </form>

      {searched && notFound && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Application not found</p>
          <p className="mt-1">
            No application matches{" "}
            <span className="font-mono">{applicationId.trim()}</span>.
            Please check your Application ID and try again.
          </p>
        </div>
      )}

      {application && (
        <div className="mt-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-text-primary">
                {application.eventName}
              </p>
              <p className="mt-0.5 font-mono text-xs tracking-[0.08em] text-burgundy">
                {application.applicationId}
              </p>
            </div>
            <Badge
              tone={
                application.status === "Approved" ||
                application.status === "Confirmed"
                  ? "success"
                  : application.status === "Rejected"
                    ? "neutral"
                    : "warning"
              }
            >
              {application.status}
            </Badge>
          </div>

          {application.status === "Rejected" ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              This application was not approved. Please contact the
              Foundation for more information.
            </div>
          ) : (
            <ol className="space-y-0" role="list">
              {steps.map((step, index) => {
                const reached = statusIndex >= index;
                const isLast = index === steps.length - 1;
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
                        reached
                          ? "border-burgundy bg-burgundy text-white"
                          : "border-border bg-white text-text-muted"
                      }`}
                    >
                      {reached ? "✓" : index + 1}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          reached ? "text-text-primary" : "text-text-muted"
                        }`}
                      >
                        {step.label}
                      </p>
                      {index === 0 && (
                        <p className="mt-1 text-xs text-text-muted">
                          Applied on {formatDate(application.appliedAt)} ·{" "}
                          {application.name}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs text-text-muted">
              Questions about your application?{" "}
              <a
                href="/contact"
                className="font-semibold text-burgundy hover:underline"
              >
                Contact the Foundation
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}