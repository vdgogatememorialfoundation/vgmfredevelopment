import { classNames } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: SectionHeadingProps) {
  const alignCenter = align === "center";

  return (
    <div
      className={classNames(
        "mb-6 max-w-2xl",
        alignCenter && "mx-auto text-center"
      )}
    >
      {eyebrow && (
        <p className="eyebrow">
          {eyebrow}
        </p>
      )}

      <h2 className="heading-2">{title}</h2>

      {description && (
        <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
      )}
    </div>
  );
}