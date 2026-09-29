"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Badge from "@/components/common/Badge";
import { getAllApplications } from "@/lib/applications";
import type { Application } from "@/types";
import { formatDate } from "@/lib/utils";

export default function ApplicationsList({
  email,
  emptyCta,
}: {
  email?: string;
  emptyCta?: { label: string; href: string };
}) {
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const all = getAllApplications();
      const mine = email
        ? all.filter(
            (app) => app.email.toLowerCase() === email.toLowerCase()
          )
        : all;
      setApplications(
        mine.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [email]);

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warm-cream text-2xl">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
          </svg>
        </div>
        <h2 className="mt-4 font-semibold text-text-primary">
          No registrations found here
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
          Event and seminar registrations are handled on the official
          seminar website. You will be redirected there to register, and
          can track your application on that site.
        </p>
        {emptyCta && (
          <Link href={emptyCta.href} className="btn-primary mt-6">
            {emptyCta.label}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <article
          key={app.applicationId}
          className="card p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-text-primary">
                {app.eventName}
              </p>
              <p className="mt-0.5 font-mono text-xs tracking-[0.08em] text-burgundy">
                {app.applicationId}
              </p>
            </div>
            <Badge
              tone={
                app.status === "Approved" || app.status === "Confirmed"
                  ? "success"
                  : app.status === "Rejected"
                    ? "neutral"
                    : "warning"
              }
            >
              {app.status}
            </Badge>
          </div>

          <p className="mt-3 text-sm text-text-muted">
            Applied on {formatDate(app.appliedAt)}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Link
              href={`/application-status?applicationId=${app.applicationId}`}
              className="text-sm font-semibold text-burgundy hover:underline"
            >
              Track application status →
            </Link>
            <span className="text-xs text-text-muted">
              {app.name} · {app.email}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}