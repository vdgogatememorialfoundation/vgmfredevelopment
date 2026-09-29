import { classNames } from "@/lib/utils";

export default function Logo({
  className,
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={classNames("h-11 w-11 shrink-0", className)}
    >
      <defs>
        <linearGradient id="vgmf-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light ? "#ffffff" : "#0f5fa8"} stopOpacity={light ? 0.14 : 1} />
          <stop offset="1" stopColor={light ? "#ffffff" : "#0a1a33"} stopOpacity={light ? 0.04 : 1} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#vgmf-logo-bg)" stroke="#c9953c" strokeWidth="1.2" />
      <g stroke="#c9953c" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M24 12c5 4.5 5 11 0 16-5-5-5-11.5 0-16z" fill="#c9953c" fillOpacity="0.2" />
        <path d="M24 28c-6.5 0-10.5-3.8-11.5-9 5 .2 9 2.8 11.5 9z" />
        <path d="M24 28c6.5 0 10.5-3.8 11.5-9-5 .2-9 2.8-11.5 9z" />
        <path d="M24 28v8" />
        <path d="M16 36h16" />
      </g>
    </svg>
  );
}
