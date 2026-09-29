import {
  BookOpen,
  CalendarDays,
  Newspaper,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import Mandala from "@/components/graphics/Mandala";
import { classNames } from "@/lib/utils";

interface MediaPlaceholderProps {
  label?: string;
  src?: string;
  aspectClassName?: string;
  className?: string;
  variant?: "event" | "book" | "article" | "clinic";
}

const variants: Record<
  NonNullable<MediaPlaceholderProps["variant"]>,
  { bg: string; icon: LucideIcon; mandala: string; text: string }
> = {
  event: {
    bg: "from-navy via-burgundy-dark to-burgundy",
    icon: CalendarDays,
    mandala: "text-gold/30",
    text: "text-white",
  },
  book: {
    bg: "from-[#3a2410] via-[#7a4f1f] to-gold",
    icon: BookOpen,
    mandala: "text-white/20",
    text: "text-white",
  },
  article: {
    bg: "from-sage-light via-warm-cream to-gold-light",
    icon: Newspaper,
    mandala: "text-sage/25",
    text: "text-text-primary",
  },
  clinic: {
    bg: "from-sage via-[#276a4d] to-navy",
    icon: Stethoscope,
    mandala: "text-white/15",
    text: "text-white",
  },
};

export default function MediaPlaceholder({
  label,
  aspectClassName = "aspect-[16/9]",
  className,
  variant = "event",
}: MediaPlaceholderProps) {
  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div
      className={classNames(
        "group/media @container relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
        config.bg,
        aspectClassName,
        className
      )}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Mandala
        className={classNames(
          "absolute -right-10 -top-10 hidden h-56 w-56 transition @[8rem]:block duration-700 group-hover/media:rotate-45 group-hover/media:scale-110",
          config.mandala
        )}
      />
      <div className="absolute inset-0 bg-dots opacity-30" aria-hidden="true" />

      <div className={classNames("relative z-10 px-6 text-center", config.text)}>
        <div
          className={classNames(
            "mx-auto flex scale-50 items-center justify-center rounded-2xl @[8rem]:scale-100 border border-white/30 bg-white/15 shadow-lg backdrop-blur transition duration-500 group-hover/media:scale-110",
            variant === "book" ? "h-16 w-16" : "h-14 w-14"
          )}
        >
          <Icon size={variant === "book" ? 28 : 24} strokeWidth={1.6} />
        </div>

        {label && (
          <p className="mx-auto mt-4 hidden max-w-[16rem] @[10rem]:block font-display text-base font-semibold leading-snug line-clamp-2">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
