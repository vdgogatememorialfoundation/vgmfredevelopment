"use client";

import type { ReactNode } from "react";
import { NaturalImage } from "@/components/common/NaturalImage";
import VideoFrame from "@/components/videos/VideoFrame";
import type { ArticleStyle, CaptionedImage } from "@/types";

export const ARTICLE_FONTS: { id: NonNullable<ArticleStyle["font"]>; label: string; stack: string }[] = [
  { id: "serif", label: "Serif (classic)", stack: "Georgia, 'Times New Roman', serif" },
  { id: "sans", label: "Sans serif (modern)", stack: "Inter, 'Segoe UI', Arial, sans-serif" },
  { id: "book", label: "Book (Palatino)", stack: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { id: "indic", label: "Indian languages (Noto)", stack: "'Noto Sans', 'Noto Sans Devanagari', 'Mukta', sans-serif" },
];

const SIZES: Record<NonNullable<ArticleStyle["size"]>, string> = { sm: "0.95rem", md: "1.05rem", lg: "1.2rem" };
const SPACING: Record<NonNullable<ArticleStyle["spacing"]>, string> = { tight: "1.55", normal: "1.8", relaxed: "2.05" };
const ALIGN = /^\|(left|center|right|justify)\|\s*/;

export function articleTextStyle(style?: ArticleStyle) {
  return {
    fontFamily: ARTICLE_FONTS.find((font) => font.id === style?.font)?.stack,
    fontSize: SIZES[style?.size ?? "md"],
    lineHeight: SPACING[style?.spacing ?? "normal"],
    textAlign: style?.align,
  } as const;
}

/** **bold**, *italic*, __underline__, ~~strike~~, ==highlight== and [link](https://…). */
export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|==([^=]+)==|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+)\))/;
  const out: ReactNode[] = [];
  let rest = text;
  let index = 0;
  while (rest) {
    const match = rest.match(pattern);
    if (!match || match.index === undefined) {
      out.push(rest);
      break;
    }
    if (match.index > 0) out.push(rest.slice(0, match.index));
    const key = `${keyPrefix}-${index++}`;
    if (match[2] !== undefined) out.push(<strong key={key}>{renderInline(match[2], key)}</strong>);
    else if (match[3] !== undefined) out.push(<u key={key}>{renderInline(match[3], key)}</u>);
    else if (match[4] !== undefined) out.push(<s key={key}>{renderInline(match[4], key)}</s>);
    else if (match[5] !== undefined) out.push(<mark key={key} className="rounded bg-amber-100 px-0.5">{renderInline(match[5], key)}</mark>);
    else if (match[6] !== undefined) out.push(<em key={key}>{renderInline(match[6], key)}</em>);
    else out.push(<a key={key} href={match[8]} className="font-medium text-burgundy underline" target={match[8].startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{match[7]}</a>);
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

function Figure({ image, alt }: { image: CaptionedImage; alt: string }) {
  return (
    <figure className="mb-8">
      <NaturalImage src={image.src} alt={image.caption || alt} fit="content" className="rounded-xl border border-border" />
      {image.caption && <figcaption className="mt-2 text-center text-sm text-text-muted">{image.caption}</figcaption>}
    </figure>
  );
}

/** Renders article text and returns which gallery images were placed inline. */
export function ArticleRichText({
  content,
  images = [],
  title,
  style,
  placed = new Set<number>(),
}: {
  content: string;
  images?: CaptionedImage[];
  title: string;
  style?: ArticleStyle;
  placed?: Set<number>;
}) {
  const blocks = content.split(/\n\s*\n/).map((block, index) => {
    let text = block.trim();
    if (!text) return null;
    const imageToken = text.match(/^\[\[image:(\d+)\]\]$/);
    if (imageToken) {
      const position = Number(imageToken[1]) - 1;
      const image = images[position];
      if (!image) return null;
      placed.add(position);
      return <Figure key={index} image={image} alt={title} />;
    }
    const imageUrl = text.match(/^\[\[image-url:(\S+?)(?:\|(.*))?\]\]$/);
    if (imageUrl) return <Figure key={index} image={{ src: imageUrl[1], caption: imageUrl[2] }} alt={title} />;
    const video = text.match(/^\[\[video:(\S+?)\]\]$/);
    if (video) {
      return (
        <div key={index} className="mb-8 aspect-video overflow-hidden rounded-xl border border-border bg-white">
          <VideoFrame video={{ kind: "youtube", youtubeUrl: video[1], src: video[1], title }} />
        </div>
      );
    }
    if (/^(-{3,}|\*{3,})$/.test(text)) return <hr key={index} className="my-8 border-border" />;
    const alignMatch = text.match(ALIGN);
    const align = alignMatch?.[1] as ArticleStyle["align"] | undefined;
    if (alignMatch) text = text.replace(ALIGN, "");
    const blockStyle = align ? { textAlign: align } : undefined;
    if (text.startsWith("### ")) return <h3 key={index} className="heading-4 mb-3 mt-6" style={blockStyle}>{renderInline(text.slice(4))}</h3>;
    if (text.startsWith("## ")) return <h2 key={index} className="heading-3 mb-4 mt-8" style={blockStyle}>{renderInline(text.slice(3))}</h2>;
    const lines = text.split("\n");
    if (lines.every((line) => /^\s*[-•*]\s+/.test(line))) {
      return (
        <ul key={index} className="mb-6 list-disc space-y-1 pl-6" style={blockStyle}>
          {lines.map((line, item) => <li key={item}>{renderInline(line.replace(/^\s*[-•*]\s+/, ""), `${index}-${item}`)}</li>)}
        </ul>
      );
    }
    if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
      return (
        <ol key={index} className="mb-6 list-decimal space-y-1 pl-6" style={blockStyle}>
          {lines.map((line, item) => <li key={item}>{renderInline(line.replace(/^\s*\d+[.)]\s+/, ""), `${index}-${item}`)}</li>)}
        </ol>
      );
    }
    if (lines.every((line) => line.startsWith(">"))) {
      return (
        <blockquote key={index} className="mb-6 border-l-4 border-gold bg-warm-cream/60 px-5 py-3 italic" style={blockStyle}>
          {renderInline(lines.map((line) => line.replace(/^>\s?/, "")).join("\n"))}
        </blockquote>
      );
    }
    return <p key={index} className="text-body mb-6 whitespace-pre-line" style={blockStyle}>{renderInline(text, String(index))}</p>;
  });
  return <div style={articleTextStyle(style)}>{blocks}</div>;
}
