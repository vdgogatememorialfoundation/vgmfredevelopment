"use client";

import Link from "next/link";
import type { Clinic } from "@/types";
import Badge from "@/components/common/Badge";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function ClinicCard({ clinic }: { clinic: Clinic }) {
  const { t } = useI18n();
  return (
    <article className="card flex flex-col overflow-hidden">
      <MediaPlaceholder
        variant="clinic"
        label={clinic.name}
        src={clinic.photos?.[0]?.src}
        aspectClassName="aspect-[16/7]"
      />

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="burgundy">{clinic.city}</Badge>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-text-primary leading-snug">
          <Link
            href={`/clinics/${clinic.slug}`}
            className="transition hover:text-burgundy"
          >
            {clinic.name}
          </Link>
        </h3>

        <p className="mt-1 text-sm text-text-muted">
          {clinic.doctor} · {clinic.specialization}
        </p>

        <div className="mt-4 space-y-2 text-sm text-text-muted">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <span>{clinic.address}</span>
          </div>
          {clinic.phone ? (
            <div className="flex items-center gap-2">
              <span className="shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.5a16 16 0 0 0 6.4 6.4l1.1-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
                </svg>
              </span>
              <a className="font-medium text-burgundy" href={`tel:${clinic.phone.replace(/\s/g, "")}`}>{clinic.phone}</a>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span className="line-clamp-1">{clinic.timings}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-2">
          <Link
            href={`/clinics/${clinic.slug}`}
            className="btn-outline w-full py-2.5 text-sm"
          >
            {t("clinic.view")}
          </Link>
          {clinic.appointmentUrl ? (
            <a href={clinic.appointmentUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full py-2.5 text-sm">
              {t("clinic.book")}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}