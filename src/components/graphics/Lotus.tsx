import { classNames } from "@/lib/utils";

const outer = [-64, -32, 0, 32, 64];
const inner = [-40, -14, 14, 40];

export default function Lotus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" aria-hidden="true" className={classNames("pointer-events-none", className)}>
      <defs>
        <linearGradient id="lotus-petal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#e0457b" />
          <stop offset="1" stopColor="#fbc4d6" />
        </linearGradient>
        <linearGradient id="lotus-petal-inner" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f472a0" />
          <stop offset="1" stopColor="#fff1f6" />
        </linearGradient>
        <linearGradient id="lotus-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4caf50" />
          <stop offset="1" stopColor="#2f8a3e" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="150" rx="108" ry="16" fill="url(#lotus-leaf)" />
      <ellipse cx="120" cy="146" rx="84" ry="9" fill="#7cc576" opacity="0.55" />
      {outer.map((angle) => (
        <path
          key={`o-${angle}`}
          d="M120 142 C 92 110, 96 62, 120 34 C 144 62, 148 110, 120 142 Z"
          fill="url(#lotus-petal)"
          stroke="#c2185b"
          strokeOpacity="0.25"
          transform={`rotate(${angle} 120 142)`}
        />
      ))}
      {inner.map((angle) => (
        <path
          key={`i-${angle}`}
          d="M120 142 C 102 116, 104 82, 120 58 C 136 82, 138 116, 120 142 Z"
          fill="url(#lotus-petal-inner)"
          stroke="#e0457b"
          strokeOpacity="0.3"
          transform={`rotate(${angle} 120 142)`}
        />
      ))}
      <circle cx="120" cy="128" r="10" fill="#f2a516" />
      <circle cx="120" cy="128" r="5" fill="#f97316" />
    </svg>
  );
}
