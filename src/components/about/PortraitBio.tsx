"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/LanguageProvider";

const SIZE = 80;

function Initials({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-burgundy/30 bg-burgundy/5 font-semibold text-burgundy">
      {name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")}
    </div>
  );
}

function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function BioBlock({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="text-body mb-4 whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </>
  );
}

function PortraitSquare({ src, alt, fallback, placeholder }: { src?: string; alt: string; fallback?: string; placeholder?: string }) {
  const start = src || fallback || "";
  const [shown, setShown] = useState(start);
  useEffect(() => {
    setShown(src || fallback || "");
  }, [src, fallback]);

  if (!shown) {
    return (
      <div className="vgmf-portrait-bio__frame flex items-center justify-center border border-border bg-slate-50">
        <Initials name={placeholder || alt} />
      </div>
    );
  }

  return (
    <div className="vgmf-portrait-bio__frame overflow-hidden border border-border bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shown}
        alt={alt}
        width={SIZE}
        height={SIZE}
        onError={() => {
          if (fallback && shown !== fallback) setShown(fallback);
        }}
      />
    </div>
  );
}

export function PortraitBio({
  image,
  title,
  body,
  href,
  imageAlt,
  placeholder,
  fallback,
}: {
  image?: string;
  title: string;
  body: string;
  href?: string;
  imageAlt: string;
  placeholder?: string;
  fallback?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="vgmf-portrait-bio">
      <div className="vgmf-portrait-bio__photo">
        <PortraitSquare src={image} alt={imageAlt} placeholder={placeholder} fallback={fallback} />
      </div>
      <div className="vgmf-portrait-bio__text">
        <h2 className="heading-3">{title}</h2>
        <div className="mt-3">
          <BioBlock text={body} />
        </div>
        {href ? (
          <Link href={href} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-burgundy">
            {t("about.learnMore")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export { BioBlock, paragraphs };
