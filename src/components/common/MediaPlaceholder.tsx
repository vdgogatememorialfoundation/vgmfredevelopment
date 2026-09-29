import { classNames } from "@/lib/utils";

interface MediaPlaceholderProps {
  label?: string;
  src?: string;
  aspectClassName?: string;
  className?: string;
  variant?: "event" | "book" | "article" | "clinic";
}

const variants = {
  event: "from-burgundy/20 via-warm-cream to-[#EFE4D8]",
  book: "from-[#4F1414] via-[#7a2a2a] to-[#b0704a]",
  article: "from-[#EDE4D6] via-warm-cream to-[#F7F1E6]",
  clinic: "from-[#E7E2DA] via-warm-cream to-[#F2EBDF]",
};

const labelGlyphs = {
  event: "EV",
  book: "BK",
  article: "AR",
  clinic: "CL",
};

export default function MediaPlaceholder({
  label,
  src,
  aspectClassName = "aspect-[16/9]",
  className,
  variant = "event",
}: MediaPlaceholderProps) {
  const glyph = labelGlyphs[variant];

  return (
    <div
      className={classNames(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
        variants[variant],
        aspectClassName,
        className
      )}
      aria-hidden={label ? undefined : true}
    >
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #651C1C 0, transparent 40%), radial-gradient(circle at 80% 80%, #651C1C 0, transparent 40%)",
        }}
      />

      <div className="relative z-10 text-center px-6">
        <div
          className={classNames(
            "mx-auto mb-4 flex items-center justify-center rounded-full border-2 border-burgundy/30 bg-white/70",
            variant === "book" ? "h-20 w-20" : "h-16 w-16"
          )}
        >
          <span className="text-sm font-bold tracking-wide text-burgundy">
            {glyph}
          </span>
        </div>

        {label && (
          <p className="text-sm font-medium text-text-primary">
            {label}
          </p>
        )}

        {src && (
          <p className="mt-1 text-[11px] text-text-muted">
            {src}
          </p>
        )}
      </div>
    </div>
  );
}