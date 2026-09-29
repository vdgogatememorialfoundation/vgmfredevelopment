import Link from "next/link";
import type { Clinic } from "@/types";
import Badge from "@/components/common/Badge";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { ArrowRight, Clock, MapPin, UserRound } from "lucide-react";

export default function ClinicCard({ clinic }: { clinic: Clinic }) {
  return (
    <article className="card group flex h-full flex-col overflow-hidden">
      <MediaPlaceholder
        variant="clinic"
        label={clinic.name}
        src={undefined}
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

        <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
          <UserRound size={14} />
          {clinic.doctor} · {clinic.specialization}
        </p>

        <div className="mb-6 mt-4 space-y-2 text-sm text-text-muted">
          <div className="flex items-start gap-2">
            <MapPin size={15} className="mt-0.5 shrink-0 text-burgundy" />
            <span className="line-clamp-2">{clinic.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={15} className="shrink-0 text-burgundy" />
            <span className="line-clamp-1">{clinic.timings}</span>
          </div>
        </div>

        <Link
          href={`/clinics/${clinic.slug}`}
          className="btn-outline mt-auto w-full py-2.5 text-sm"
        >
          View Clinic
          <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  );
}