import { classNames } from "@/lib/utils";

export default function Toran({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 56"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      className={classNames("pointer-events-none block h-10 w-full sm:h-14", className)}
    >
      <defs>
        <pattern id="toran-unit" width="80" height="56" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q40 22 80 6" fill="none" stroke="#9a3412" strokeWidth="1.2" strokeOpacity="0.5" />
          <circle cx="12" cy="10" r="6" fill="#f97316" />
          <circle cx="26" cy="14" r="6" fill="#f2a516" />
          <circle cx="40" cy="15" r="6" fill="#f97316" />
          <circle cx="54" cy="14" r="6" fill="#f2a516" />
          <circle cx="68" cy="10" r="6" fill="#f97316" />
          <path d="M40 20 C 32 30, 34 42, 40 52 C 46 42, 48 30, 40 20 Z" fill="#2f8a3e" />
          <path d="M40 22 L40 50" stroke="#7cc576" strokeWidth="1" />
          <circle cx="40" cy="20" r="3" fill="#e0457b" />
        </pattern>
      </defs>
      <rect width="1440" height="56" fill="url(#toran-unit)" />
    </svg>
  );
}
