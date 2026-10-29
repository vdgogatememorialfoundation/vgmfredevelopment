import { classNames } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  action?: ReactNode;
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
}: SectionHeadingProps) {
  const alignCenter = align === "center";

  return (
    <div className={classNames("mb-7", alignCenter && "mx-auto max-w-2xl text-center")}>
      <div
        className={classNames(
          "flex flex-wrap items-end justify-between gap-3",
          !alignCenter && "border-b border-border pb-3"
        )}
      >
        <div className={classNames(!alignCenter && "border-l-[3px] border-burgundy pl-3")}>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="heading-2">{title}</h2>
        </div>
        {action}
      </div>
      {description && (
        <p className={classNames("mt-3 max-w-2xl text-sm leading-6 text-text-muted", alignCenter && "mx-auto")}>
          {description}
        </p>
      )}
    </div>
  );
}
