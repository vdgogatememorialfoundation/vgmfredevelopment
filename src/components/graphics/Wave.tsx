import { classNames } from "@/lib/utils";

export default function Wave({
  className,
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={classNames(
        "block h-10 w-full sm:h-16",
        flip && "rotate-180",
        className
      )}
    >
      <path
        d="M0 40c120 26 240 40 360 40s240-14 360-40 240-40 360-40 240 14 360 40v40H0z"
        fill="currentColor"
      />
    </svg>
  );
}
