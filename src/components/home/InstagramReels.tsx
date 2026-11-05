"use client";

import { reelCode } from "@/lib/site-extras";
import { useSiteText } from "@/lib/use-site-text";

export default function InstagramReels() {
  const reels = (useSiteText().reels ?? []).filter((reel) => reel.enabled && reelCode(reel.url));
  if (!reels.length) return null;
  return (
    <section className="section-padding bg-white" aria-labelledby="home-reels">
      <div className="container">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-burgundy">Instagram</p>
        <h2 id="home-reels" className="heading-2 mt-1 text-ink">Reels from the Foundation</h2>
        <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-3">
          {reels.map((reel) => (
            <figure key={reel.id} className="w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <iframe
                src={`https://www.instagram.com/reel/${reelCode(reel.url)}/embed`}
                title={reel.caption || "Instagram reel"}
                loading="lazy"
                allow="encrypted-media; picture-in-picture"
                className="h-[530px] w-full border-0"
              />
              {reel.caption ? <figcaption className="px-3 py-2 text-sm text-ink">{reel.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
