import Ornament from "@/components/graphics/Ornament";
import Reveal from "@/components/common/Reveal";
import { classNames } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  tone?: "light" | "dark";
  id?: string;
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
  id,
}: SectionHeadingProps) {
  const alignCenter = align === "center";
  const dark = tone === "dark";

  return (
    <Reveal
      className={classNames(
        "mb-12 max-w-3xl",
        alignCenter && "mx-auto text-center"
      )}
    >
      {eyebrow && (
        <p
          className={classNames(
            "eyebrow",
            alignCenter && "justify-center",
            dark && "text-gold"
          )}
        >
          <span className={classNames("h-px w-6", dark ? "bg-gold/60" : "bg-burgundy/40")} />
          {eyebrow}
          <span className={classNames("h-px w-6", dark ? "bg-gold/60" : "bg-burgundy/40")} />
        </p>
      )}

      <h2 id={id} className={classNames("heading-2 text-balance", dark && "text-white")}>
        {title}
      </h2>

      <Ornament
        className={classNames(
          "mt-5",
          alignCenter && "mx-auto",
          dark ? "text-gold" : "text-gold"
        )}
      />

      {description && (
        <p className={classNames("mt-5 text-body-lg", dark && "text-white/70")}>
          {description}
        </p>
      )}
    </Reveal>
  );
}
