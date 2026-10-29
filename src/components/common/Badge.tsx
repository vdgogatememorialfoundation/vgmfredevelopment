import { classNames } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  tone?: "burgundy" | "neutral" | "success" | "warning" | "gold" | "ink";
  className?: string;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  burgundy: "bg-burgundy/10 text-burgundy",
  gold: "bg-gold/10 text-gold",
  ink: "bg-ink/5 text-ink",
  neutral: "bg-stone-100 text-stone-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
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