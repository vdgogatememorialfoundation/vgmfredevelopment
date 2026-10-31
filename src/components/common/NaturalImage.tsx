"use client";

import { useState } from "react";
import { classNames } from "@/lib/utils";

type Fit = "content" | "hero" | "card" | "thumb";

const MAX: Record<Fit, string> = {
  hero: "max-h-[28rem]",
  content: "max-h-[36rem]",
  card: "max-h-64",
  thumb: "max-h-40",
};

export function NaturalImage({
  src,
  alt,
  className,
  imgClassName,
  fit = "content",
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fit?: Fit;
}) {
  const [shape, setShape] = useState<"wide" | "tall" | "square" | "unknown">("unknown");

  return (
    <div
      className={classNames(
        "flex items-center justify-center overflow-hidden bg-paper",
        shape === "tall" && "mx-auto max-w-sm",
        shape === "square" && "mx-auto max-w-lg",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={(event) => {
          const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
          if (!width || !height) return;
          const ratio = width / height;
          setShape(ratio >= 1.15 ? "wide" : ratio <= 0.88 ? "tall" : "square");
        }}
        className={classNames(
          "h-auto max-w-full object-contain",
          MAX[fit],
          shape === "tall" ? "w-auto" : "w-full",
          imgClassName
        )}
      />
    </div>
  );
}
