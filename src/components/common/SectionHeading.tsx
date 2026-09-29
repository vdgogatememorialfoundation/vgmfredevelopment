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
        "mb-10 max-w-3xl",
        alignCenter && "mx-auto text-center"
      )}
    >
      {eyebrow && (
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-burgundy">
          {eyebrow}
        </p>
      )}

      <h2 className="heading-2">{title}</h2>

      {description && (
        <p className="mt-4 text-body-lg">{description}</p>
      )}
    </div>
  );
}