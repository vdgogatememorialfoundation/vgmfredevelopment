import { classNames } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={classNames("h-11 w-11 shrink-0", className)}>
      <defs>
        <linearGradient id="vgmf-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2a516" />
          <stop offset="1" stopColor="#c2410c" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#vgmf-logo-bg)" />
      <circle cx="24" cy="24" r="20" fill="none" stroke="#fff1cc" strokeWidth="0.8" strokeDasharray="1.5 2" />
      <g fill="#fffcf6" stroke="#fffcf6" strokeWidth="1" strokeLinejoin="round">
        <path d="M24 11c4.6 4.2 4.6 10.8 0 16-4.6-5.2-4.6-11.8 0-16z" />
        <path d="M24 27c-6.2 0-10.4-3.8-11.6-9 5.2.3 9.2 3 11.6 9z" fillOpacity="0.85" />
        <path d="M24 27c6.2 0 10.4-3.8 11.6-9-5.2.3-9.2 3-11.6 9z" fillOpacity="0.85" />
      </g>
      <path d="M13 33c3.5 2.6 7.2 3.8 11 3.8S31.5 35.6 35 33" fill="none" stroke="#fffcf6" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="36.8" r="1.6" fill="#2f8a3e" />
    </svg>
  );
}
