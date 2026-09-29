import { classNames } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  tone?: "burgundy" | "neutral" | "success" | "warning" | "gold" | "dark";
  className?: string;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  burgundy: "bg-burgundy/10 text-burgundy ring-burgundy/15",
  neutral: "bg-slate-100 text-text-muted ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  gold: "bg-gold-light text-[#8a6320] ring-gold/30",
  dark: "bg-navy/80 text-white ring-white/10 backdrop-blur",
};

export default function Badge({
  children,
  tone = "burgundy",
  className,
}: BadgeProps) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
