import { classNames } from "@/lib/utils";

export default function Diya({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={classNames("pointer-events-none h-12 w-12", className)}>
      <defs>
        <radialGradient id="diya-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diya-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="0.6" stopColor="#f2a516" />
          <stop offset="1" stopColor="#fff7d6" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="22" r="18" fill="url(#diya-glow)" />
      <g className="origin-[32px_34px] animate-flicker">
        <path d="M32 8 C 26 18, 27 28, 32 34 C 37 28, 38 18, 32 8 Z" fill="url(#diya-flame)" />
      </g>
      <path d="M6 38 C 14 56, 50 56, 58 38 Z" fill="#c2410c" />
      <path d="M6 38 H58" stroke="#9a3412" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 44 C 22 50, 42 50, 50 44" fill="none" stroke="#f2a516" strokeWidth="2" strokeDasharray="2 3" />
    </svg>
  );
}
