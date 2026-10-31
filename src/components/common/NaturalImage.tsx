"use client";

import { useState } from "react";
import { classNames } from "@/lib/utils";

type Fit = "content" | "hero" | "card" | "thumb" | "portrait";

const MAX: Record<Fit, string> = {
  hero: "max-h-[28rem]",
  content: "max-h-[36rem]",
  portrait: "max-h-[32rem]",
  card: "max-h-56",
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
  const portraitLike = fit === "portrait" || shape !== "wide";

  return (
    <div
      className={classNames(
        "flex items-center justify-center bg-transparent",
        portraitLike && "mx-auto w-fit max-w-full",
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
          portraitLike ? "w-auto" : "w-full",
          imgClassName
        )}
      />
    </div>
  );
}
