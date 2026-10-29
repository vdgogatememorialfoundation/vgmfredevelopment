import { classNames } from "@/lib/utils";

interface MediaPlaceholderProps {
  label?: string;
  src?: string;
  aspectClassName?: string;
  className?: string;
  variant?: "event" | "book" | "article" | "clinic";
}

const variants = {
  event: "from-slate-100 via-white to-slate-50",
  book: "from-slate-100 via-white to-slate-50",
  article: "from-slate-100 via-white to-slate-50",
  clinic: "from-slate-100 via-white to-slate-50",
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

  if (src && /^(https?:|data:image)/.test(src)) {
    return (
      <div className={classNames("relative overflow-hidden bg-warm-cream", aspectClassName, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label ?? ""} className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }

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
            "radial-gradient(circle at 20% 20%, #2F7A57 0, transparent 40%), radial-gradient(circle at 80% 80%, #2F7A57 0, transparent 40%)",
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

      </div>
    </div>
  );
}