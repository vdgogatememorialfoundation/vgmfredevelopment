import { classNames } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  tone?: "burgundy" | "neutral" | "success" | "warning";
  className?: string;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  burgundy: "bg-burgundy/10 text-burgundy",
  neutral: "bg-slate-100 text-text-muted",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
};

export default function Badge({
  children,
  tone = "burgundy",
  className,
}: BadgeProps) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}