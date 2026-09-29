import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import Diya from "@/components/graphics/Diya";
import LeafSprig from "@/components/graphics/LeafSprig";
import type { Banner } from "@/lib/cms/defaults";
import { bannerTheme } from "@/components/banners/themes";
import { classNames } from "@/lib/utils";

export default function DisplayBanner({
  banner,
  compact = false,
}: {
  banner?: Banner;
  compact?: boolean;
}) {
  if (!banner) return null;

  return (
    <section aria-label={banner.title} className={compact ? "pb-2 pt-6" : "bg-background py-8 sm:py-10"}>
      <div className="container">
        <div
          className={classNames(
            "relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-gradient-to-r p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-8",
            bannerTheme(banner.theme)
          )}
        >
          {banner.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-soft-light" />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-rangoli opacity-30" />
          <LeafSprig className="pointer-events-none absolute -left-4 -top-6 h-24 w-24 rotate-12 text-white/30" />
          <div className="relative flex items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/40 sm:flex">
              {compact ? <Sparkles size={24} /> : <Diya className="h-10 w-10" />}
            </span>
            <div>
              {banner.eyebrow ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">{banner.eyebrow}</p>
              ) : null}
              <h2 className={classNames("mt-1 font-serif font-bold leading-tight", compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl")}>
                {banner.title}
              </h2>
              {banner.subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-white/90">{banner.subtitle}</p> : null}
            </div>
          </div>
          <div className="relative flex shrink-0 flex-wrap gap-3">
            {banner.ctaLabel && banner.ctaHref ? (
              <Link
                href={banner.ctaHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-burgundy shadow transition hover:-translate-y-0.5"
              >
                {banner.ctaLabel}
                <ArrowRight size={16} />
              </Link>
            ) : null}
            {banner.secondaryLabel && banner.secondaryHref ? (
              <Link
                href={banner.secondaryHref}
                className="inline-flex items-center gap-2 rounded-full border border-white/70 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                {banner.secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
