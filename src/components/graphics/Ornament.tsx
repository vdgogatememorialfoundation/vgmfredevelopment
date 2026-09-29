import { classNames } from "@/lib/utils";

export default function Ornament({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 12"
      fill="none"
      aria-hidden="true"
      className={classNames("h-3 w-28", className)}
    >
      <path d="M0 6h46" stroke="currentColor" strokeOpacity="0.5" />
      <path d="M74 6h46" stroke="currentColor" strokeOpacity="0.5" />
      <path d="M60 0l6 6-6 6-6-6z" fill="currentColor" />
      <circle cx="50" cy="6" r="1.8" fill="currentColor" />
      <circle cx="70" cy="6" r="1.8" fill="currentColor" />
    </svg>
  );
}
