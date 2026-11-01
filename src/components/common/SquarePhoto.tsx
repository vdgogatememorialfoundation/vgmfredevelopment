import { classNames } from "@/lib/utils";

export function SquarePhoto({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const initials = alt
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const image = src?.trim() || fallback?.trim() || "";

  return (
    <div className={classNames("aspect-square w-full overflow-hidden rounded-lg bg-ink", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={alt} className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-serif text-2xl font-semibold text-white">
          {initials || "VG"}
        </div>
      )}
    </div>
  );
}
