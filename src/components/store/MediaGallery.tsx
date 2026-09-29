"use client";

import { useState } from "react";
import type { Book, ProductMedia } from "@/types";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";

export default function MediaGallery({ book }: { book: Book }) {
  const media: ProductMedia[] = book.media?.length
    ? book.media
    : [{ type: "image", label: "Book cover" }];
  const [active, setActive] = useState(0);

  const current = media[active];

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        {current.type === "video" ? (
          <div className="relative aspect-[4/3] w-full">
            <MediaPlaceholder
              variant="book"
              label={current.label}
              src={current.src}
              aspectClassName="aspect-[4/3]"
            />
            <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-burgundy/90 text-white shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
              Video
            </span>
          </div>
        ) : (
          <MediaPlaceholder
            variant="book"
            label={current.label}
            src={current.src}
            aspectClassName="aspect-[4/3]"
          />
        )}
      </div>

      {media.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {media.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              aria-label={`View ${item.label}`}
              onClick={() => setActive(index)}
              className={`relative overflow-hidden rounded-xl border-2 transition ${
                active === index
                  ? "border-burgundy"
                  : "border-border hover:border-burgundy/40"
              }`}
            >
              <MediaPlaceholder
                variant="book"
                label={item.label}
                src={item.src}
                aspectClassName="aspect-square"
              />
              {item.type === "video" && (
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-burgundy/90 text-white">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              )}
              {active === index && (
                <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wide text-burgundy">
                  {item.type}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}