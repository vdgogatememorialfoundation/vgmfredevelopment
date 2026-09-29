import { classNames } from "@/lib/utils";

interface MandalaProps {
  className?: string;
  strokeWidth?: number;
}

const petals = Array.from({ length: 16 }, (_, index) => index * 22.5);
const leaves = Array.from({ length: 8 }, (_, index) => index * 45);

export default function Mandala({ className, strokeWidth = 1 }: MandalaProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      className={classNames("pointer-events-none", className)}
    >
      <circle cx="200" cy="200" r="196" opacity="0.35" />
      <circle cx="200" cy="200" r="170" strokeDasharray="2 6" opacity="0.6" />
      <circle cx="200" cy="200" r="120" opacity="0.5" />
      <circle cx="200" cy="200" r="60" opacity="0.7" />
      <circle cx="200" cy="200" r="22" opacity="0.9" />
      {petals.map((angle) => (
        <g key={`p-${angle}`} transform={`rotate(${angle} 200 200)`}>
          <path d="M200 30 C 222 80, 222 110, 200 140 C 178 110, 178 80, 200 30 Z" opacity="0.55" />
          <circle cx="200" cy="18" r="3" opacity="0.7" />
        </g>
      ))}
      {leaves.map((angle) => (
        <g key={`l-${angle}`} transform={`rotate(${angle} 200 200)`}>
          <path d="M200 140 C 226 160, 226 180, 200 200 C 174 180, 174 160, 200 140 Z" opacity="0.8" />
        </g>
      ))}
    </svg>
  );
}
